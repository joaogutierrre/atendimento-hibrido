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
import { TelegramUpdate } from './telegram.types';

@Public()
@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    if (!existing && customerName) {
      // no-op — nova conversa ja foi criada com o nome
    } else if (existing && customerName && existing.customerName !== customerName) {
      await this.prisma.conversation.update({
        where: { id: existing.id },
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

    this.logger.log(
      `Telegram update received: channel=${channel.id} conv=${conversation.id} msg=${message.id}`,
    );

    return { ok: true, conversationId: conversation.id, messageId: message.id };
  }
}
