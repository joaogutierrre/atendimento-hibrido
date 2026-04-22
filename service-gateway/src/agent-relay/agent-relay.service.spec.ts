import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConversationMode, SenderType } from '@prisma/client';

import { AgentRelayService } from './agent-relay.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { ChatGateway } from '../socket/chat.gateway';

// Prevent ioredis from opening real connections during unit tests
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(2),
    quit: jest.fn().mockResolvedValue('OK'),
  })),
);

describe('AgentRelayService', () => {
  let service: AgentRelayService;

  const mockPrisma = {
    conversation: { update: jest.fn() },
  };
  const mockMessaging = { sendViaConversation: jest.fn() };
  const mockChat = { emitMessage: jest.fn(), emitEscalated: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AgentRelayService,
        { provide: ConfigService, useValue: { get: () => 'redis://localhost:6379' } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: ChatGateway, useValue: mockChat },
      ],
    }).compile();

    service = module.get(AgentRelayService);
  });

  // ── Critério 1: mensagem recebida → resposta IA entregue ──────────────

  describe('handleRespond', () => {
    it('persists AI message and delivers it via channel provider', async () => {
      const createdAt = new Date('2026-01-01T12:00:00Z');
      mockMessaging.sendViaConversation.mockResolvedValue({
        id: 'msg-ai-1',
        content: 'Nosso horário é 9h–18h.',
        sender: SenderType.AI,
        createdAt,
      });

      await (service as any).handleRespond({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        content: 'Nosso horário é 9h–18h.',
      });

      expect(mockMessaging.sendViaConversation).toHaveBeenCalledWith(
        'conv-1',
        'Nosso horário é 9h–18h.',
        SenderType.AI,
      );
    });

    it('emits conversation:message via Socket.io so the panel updates', async () => {
      const createdAt = new Date();
      mockMessaging.sendViaConversation.mockResolvedValue({
        id: 'msg-ai-2',
        content: 'Tudo certo!',
        sender: SenderType.AI,
        createdAt,
      });

      await (service as any).handleRespond({
        conversationId: 'conv-2',
        tenantId: 'tenant-1',
        content: 'Tudo certo!',
      });

      expect(mockChat.emitMessage).toHaveBeenCalledWith(
        'tenant-1',
        'conv-2',
        expect.objectContaining({
          id: 'msg-ai-2',
          conversationId: 'conv-2',
          sender: SenderType.AI,
        }),
      );
    });
  });

  // ── Critério 2: gatilho de escalonamento → Socket.io notifica painel ──

  describe('handleEscalate', () => {
    it('sets conversation mode to HUMAN in DB', async () => {
      mockPrisma.conversation.update.mockResolvedValue({
        id: 'conv-3',
        mode: ConversationMode.HUMAN,
      });

      await (service as any).handleEscalate({
        conversationId: 'conv-3',
        tenantId: 'tenant-1',
        reason: 'Palavra-gatilho: cancelar',
      });

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-3' },
        data: { mode: ConversationMode.HUMAN },
      });
    });

    it('emits conversation:escalated via Socket.io with reason', async () => {
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-4', mode: ConversationMode.HUMAN });

      await (service as any).handleEscalate({
        conversationId: 'conv-4',
        tenantId: 'tenant-2',
        reason: 'Cliente pediu falar com humano',
      });

      expect(mockChat.emitEscalated).toHaveBeenCalledWith(
        'tenant-2',
        expect.objectContaining({
          conversationId: 'conv-4',
          reason: 'Cliente pediu falar com humano',
        }),
      );
    });

    it('does not call emitMessage on escalation (wrong event)', async () => {
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-5', mode: ConversationMode.HUMAN });

      await (service as any).handleEscalate({
        conversationId: 'conv-5',
        tenantId: 'tenant-1',
        reason: 'Sem resposta na base',
      });

      expect(mockChat.emitMessage).not.toHaveBeenCalled();
    });
  });

  // ── dispatch error isolation ──────────────────────────────────────────

  describe('dispatch', () => {
    it('does not throw on malformed JSON — logs error and moves on', async () => {
      await expect(
        (service as any).dispatch('agent:respond', 'not-json'),
      ).resolves.not.toThrow();
    });
  });
});
