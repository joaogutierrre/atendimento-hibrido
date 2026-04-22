import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType, MessagingChannel } from '@prisma/client';

import { IMessagingProvider, SendResult } from '../messaging.interface';

const WA_API_VERSION = 'v19.0';

@Injectable()
export class WhatsAppProvider implements IMessagingProvider {
  readonly channel = ChannelType.WHATSAPP;
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  async sendMessage(
    channel: MessagingChannel,
    to: string,
    content: string,
  ): Promise<SendResult> {
    if (this.config.get<string>('MESSAGING_DRY_RUN') === 'true') {
      this.logger.debug(`[dry-run] WHATSAPP -> ${to}: ${content}`);
      return { externalId: `dry-${Date.now()}` };
    }

    const phoneNumberId = channel.identifier;
    const accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');

    const res = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: content },
        }),
      },
    );

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!res.ok || json.error) {
      throw new Error(`WhatsApp sendMessage failed: ${json.error?.message ?? res.statusText}`);
    }

    return { externalId: json.messages?.[0]?.id ?? '' };
  }

  async setup(_channel: MessagingChannel): Promise<void> {
    // WhatsApp webhooks are configured in the Meta Developer Portal manually.
    this.logger.log('WhatsApp channel registered — configure webhook in Meta Developer Portal');
  }
}
