import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType, MessagingChannel } from '@prisma/client';
import { IMessagingProvider, SendResult } from '../messaging.interface';

@Injectable()
export class TelegramProvider implements IMessagingProvider {
  readonly channel = ChannelType.TELEGRAM;
  private readonly logger = new Logger(TelegramProvider.name);

  constructor(private readonly config: ConfigService) {}

  private botApi(token: string, method: string): string {
    return `https://api.telegram.org/bot${token}/${method}`;
  }

  async sendMessage(
    channel: MessagingChannel,
    to: string,
    content: string,
  ): Promise<SendResult> {
    const token = channel.identifier;
    const res = await fetch(this.botApi(token, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: to, text: content }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!res.ok || !json.ok) {
      throw new Error(`Telegram sendMessage failed: ${json.description ?? res.statusText}`);
    }
    return { externalId: String(json.result?.message_id ?? '') };
  }

  async setup(channel: MessagingChannel): Promise<void> {
    const baseUrl = this.config.get<string>('PUBLIC_BASE_URL');
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      this.logger.warn(
        `PUBLIC_BASE_URL ausente ou aponta para localhost — webhook do canal ${channel.id} nao registrado. Defina PUBLIC_BASE_URL para uma URL acessivel pela internet (ngrok, dominio publico).`,
      );
      return;
    }
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/telegram/webhook/${channel.id}`;
    try {
      const res = await fetch(this.botApi(channel.identifier, 'setWebhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          drop_pending_updates: true,
        }),
      });
      const json = (await res.json()) as { ok: boolean; description?: string };
      if (!json.ok) {
        this.logger.error(`setWebhook failed for channel ${channel.id}: ${json.description}`);
      } else {
        this.logger.log(`Telegram webhook registrado para canal ${channel.id} -> ${webhookUrl}`);
      }
    } catch (err) {
      this.logger.error(`setWebhook error for channel ${channel.id}: ${(err as Error).message}`);
    }
  }
}
