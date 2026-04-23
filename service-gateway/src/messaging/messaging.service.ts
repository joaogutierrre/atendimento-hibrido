import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType, MessagingChannel, SenderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IMessagingProvider } from './messaging.interface';
import { TelegramProvider } from './telegram/telegram.provider';
import { WhatsAppProvider } from './whatsapp/whatsapp.provider';

@Injectable()
export class MessagingService {
  private readonly providers: Map<ChannelType, IMessagingProvider>;

  constructor(
    private readonly prisma: PrismaService,
    telegram: TelegramProvider,
    whatsapp: WhatsAppProvider,
  ) {
    this.providers = new Map<ChannelType, IMessagingProvider>([
      [ChannelType.TELEGRAM, telegram],
      [ChannelType.WHATSAPP, whatsapp],
    ]);
  }

  getProvider(type: ChannelType): IMessagingProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new BadRequestException(`No provider registered for channel ${type}`);
    return provider;
  }

  async setupChannel(channel: MessagingChannel): Promise<void> {
    await this.getProvider(channel.type).setup(channel);
  }

  /**
   * Send a message through the channel of the given conversation.
   * Persists a Message row with the provided sender type and returns it.
   */
  async sendViaConversation(conversationId: string, content: string, sender: SenderType) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { channel: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const provider = this.getProvider(conversation.channel.type);
    const result = await provider.sendMessage(
      conversation.channel,
      conversation.customerRef,
      content,
    );

    return this.prisma.message.create({
      data: {
        conversationId,
        sender,
        content,
        externalId: result.externalId || null,
      },
    });
  }
}
