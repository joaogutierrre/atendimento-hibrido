import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConvStatus, SenderType } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingIncomingPayload, RedisChannels } from '../../redis/redis.constants';
import { RedisPublisher } from '../../redis/redis.service';
import { ChatGateway } from '../../socket/chat.gateway';
import { TelegramUpdate } from './telegram.types';

@Public()
@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gateway: ChatGateway,
    private readonly redis: RedisPublisher,
  ) {}

  @Post(':channelId')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('channelId') channelId: string,
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    const expectedSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const msg = update.message ?? update.edited_message ?? update.channel_post;
    if (!msg?.text) {
      // ignora tipos de update nao suportados (sticker, callback_query, etc.)
      return { ok: true, ignored: true };
    }

    const channel = await this.prisma.messagingChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== 'TELEGRAM') throw new BadRequestException('Channel is not TELEGRAM');
    if (!channel.isActive) return { ok: true, ignored: true };

    const customerRef = String(msg.chat.id);
    const customerName =
      msg.from?.first_name ||
      msg.chat.first_name ||
      msg.chat.title ||
      msg.chat.username ||
      null;

    // Procura conversa aberta; se nao existir, cria uma nova em modo AI.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        channelId: channel.id,
        customerRef,
        status: { in: [ConvStatus.OPEN, ConvStatus.WAITING] },
      },
    });

    const isNew = !existing;
    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: {
          tenantId: channel.tenantId,
          branchId: channel.branchId,
          channelId: channel.id,
          customerRef,
          customerName,
        },
      }));

    if (!isNew && customerName && existing!.customerName !== customerName) {
      await this.prisma.conversation.update({
        where: { id: existing!.id },
        data: { customerName },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: SenderType.USER,
        content: msg.text,
        externalId: String(msg.message_id),
      },
    });

    if (isNew) {
      this.gateway.emitNew(channel.tenantId, {
        id: conversation.id,
        tenantId: channel.tenantId,
        branchId: channel.branchId,
        channelId: channel.id,
        channelType: channel.type,
        customerRef,
        customerName,
        mode: conversation.mode,
        status: conversation.status,
        assignedUserId: null,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });
    }
    this.gateway.emitMessage(channel.tenantId, conversation.id, {
      conversationId: conversation.id,
      tenantId: channel.tenantId,
      message,
    });

    // Publica para o service-agent processar via Redis Stream (SPEC-10)
    const payload: MessagingIncomingPayload = {
      tenantId: channel.tenantId,
      channelType: channel.type,
      conversationId: conversation.id,
      messageId: message.id,
      customerRef,
      content: msg.text,
      timestamp: message.createdAt.toISOString(),
      mode: conversation.mode,
    };
    await this.redis.xadd(RedisChannels.messagingIncoming, payload);

    this.logger.log(
      `Telegram update received: channel=${channel.id} conv=${conversation.id} msg=${message.id} (new=${isNew})`,
    );

    return { ok: true, conversationId: conversation.id, messageId: message.id };
  }
}
