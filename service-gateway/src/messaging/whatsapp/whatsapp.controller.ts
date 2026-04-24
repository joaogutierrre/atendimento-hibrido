import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConvStatus, SenderType } from '@prisma/client';
import * as crypto from 'crypto';
import { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingIncomingPayload, RedisChannels } from '../../redis/redis.constants';
import { RedisPublisher } from '../../redis/redis.service';
import { ChatGateway } from '../../socket/chat.gateway';
import { WhatsAppWebhookBody } from './whatsapp.types';

@Public()
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: ChatGateway,
    private readonly redis: RedisPublisher,
  ) {}

  /** Meta webhook verification handshake */
  @Get(':channelId')
  verify(
    @Param('channelId') _channelId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode !== 'subscribe' || token !== expected) {
      throw new UnauthorizedException('Webhook verification failed');
    }
    return challenge;
  }

  @Post(':channelId')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('channelId') channelId: string,
    @Headers('x-hub-signature-256') sigHeader: string | undefined,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WhatsAppWebhookBody,
  ) {
    this._validateHmac(sigHeader, req.rawBody);

    if (body.object !== 'whatsapp_business_account') {
      return { ok: true, ignored: true };
    }

    const channel = await this.prisma.messagingChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== 'WHATSAPP') throw new BadRequestException('Channel is not WHATSAPP');
    if (!channel.isActive) return { ok: true, ignored: true };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        for (const waMsg of change.value.messages ?? []) {
          if (waMsg.type !== 'text' || !waMsg.text?.body) continue;

          await this._processMessage(channel, waMsg, change.value.contacts);
        }
      }
    }

    return { ok: true };
  }

  private async _processMessage(
    channel: Awaited<ReturnType<PrismaService['messagingChannel']['findUnique']>> & {},
    waMsg: NonNullable<WhatsAppWebhookBody['entry'][number]['changes'][number]['value']['messages']>[number],
    contacts?: WhatsAppWebhookBody['entry'][number]['changes'][number]['value']['contacts'],
  ) {
    const customerRef = waMsg.from;
    const customerName =
      contacts?.find((c) => c.wa_id === waMsg.from)?.profile?.name ?? null;

    const existing = await this.prisma.conversation.findFirst({
      where: {
        channelId: channel!.id,
        customerRef,
        status: { in: [ConvStatus.OPEN, ConvStatus.WAITING] },
      },
    });

    const isNew = !existing;
    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: {
          tenantId: channel!.tenantId,
          branchId: channel!.branchId,
          channelId: channel!.id,
          customerRef,
          customerName,
        },
      }));

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: SenderType.USER,
        content: waMsg.text!.body,
        externalId: waMsg.id,
      },
    });

    if (isNew) {
      this.gateway.emitNew(channel!.tenantId, {
        id: conversation.id,
        tenantId: channel!.tenantId,
        branchId: channel!.branchId,
        channelId: channel!.id,
        channelType: channel!.type,
        customerRef,
        customerName,
        mode: conversation.mode,
        status: conversation.status,
        assignedUserId: null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });
    }
    this.gateway.emitMessage(channel!.tenantId, conversation.id, {
      conversationId: conversation.id,
      tenantId: channel!.tenantId,
      message,
    });

    const payload: MessagingIncomingPayload = {
      tenantId: channel!.tenantId,
      channelType: channel!.type as 'WHATSAPP',
      conversationId: conversation.id,
      messageId: message.id,
      customerRef,
      content: waMsg.text!.body,
      timestamp: message.createdAt.toISOString(),
      mode: conversation.mode,
    };
    await this.redis.xadd(RedisChannels.messagingIncoming, payload);

    this.logger.log(
      `WhatsApp message: channel=${channel!.id} conv=${conversation.id} msg=${message.id} (new=${isNew})`,
    );
  }

  private _validateHmac(sigHeader: string | undefined, rawBody: Buffer | undefined) {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) return; // skip validation if secret not configured

    if (!sigHeader || !rawBody) {
      throw new UnauthorizedException('Missing HMAC signature');
    }

    const expected = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(sigHeader);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }
  }
}
