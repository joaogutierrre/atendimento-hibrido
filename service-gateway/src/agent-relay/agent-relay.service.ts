import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationMode, SenderType } from '@prisma/client';
import Redis from 'ioredis';

import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { ChatGateway } from '../socket/chat.gateway';

interface RespondPayload {
  conversationId: string;
  tenantId: string;
  content: string;
}

interface EscalatePayload {
  conversationId: string;
  tenantId: string;
  reason: string;
}

@Injectable()
export class AgentRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRelayService.name);
  private subscriber!: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly chat: ChatGateway,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.subscriber = new Redis(url);
    this.subscriber.on('error', (err) =>
      this.logger.error(`subscriber error: ${err.message}`),
    );

    void this.subscriber.subscribe('agent:respond', 'agent:escalate');
    this.subscriber.on('message', (channel: string, raw: string) => {
      void this.dispatch(channel, raw);
    });

    this.logger.log('Subscribed to agent:respond and agent:escalate');
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }

  private async dispatch(channel: string, raw: string) {
    try {
      const payload = JSON.parse(raw) as RespondPayload | EscalatePayload;
      if (channel === 'agent:respond') {
        await this.handleRespond(payload as RespondPayload);
      } else if (channel === 'agent:escalate') {
        await this.handleEscalate(payload as EscalatePayload);
      }
    } catch (err) {
      this.logger.error(
        `Error handling ${channel}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async handleRespond({ conversationId, tenantId, content }: RespondPayload) {
    const message = await this.messaging.sendViaConversation(
      conversationId,
      content,
      SenderType.AI,
    );

    this.chat.emitMessage(tenantId, conversationId, {
      id: message.id,
      conversationId,
      content,
      sender: SenderType.AI,
      createdAt: message.createdAt,
    });

    this.logger.log(`agent:respond delivered conv=${conversationId}`);
  }

  private async handleEscalate({ conversationId, tenantId, reason }: EscalatePayload) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { mode: ConversationMode.HUMAN },
    });

    this.chat.emitEscalated(tenantId, { conversationId, reason });

    this.logger.log(`agent:escalate conv=${conversationId} mode=HUMAN reason="${reason}"`);
  }
}
