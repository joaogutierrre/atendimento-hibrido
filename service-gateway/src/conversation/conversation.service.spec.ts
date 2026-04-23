import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConvStatus, ConversationMode, SenderType } from '@prisma/client';

import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { ChatGateway } from '../socket/chat.gateway';
import { RedisPublisher } from '../redis/redis.service';

describe('ConversationService', () => {
  let service: ConversationService;

  const mockPrisma = {
    conversation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    message: { create: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const mockMessaging = { sendViaConversation: jest.fn() };
  const mockGateway = { emitMessage: jest.fn(), emitUpdated: jest.fn() };
  const mockRedis = { publish: jest.fn().mockResolvedValue(0) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: ChatGateway, useValue: mockGateway },
        { provide: RedisPublisher, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(ConversationService);
  });

  // ── Critério 4: isolamento multi-tenant ───────────────────────────────

  describe('multi-tenant isolation', () => {
    it('throws ForbiddenException when Tenant A requests Tenant B conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-b',
        tenantId: 'tenant-b',
        status: ConvStatus.OPEN,
        mode: ConversationMode.AI,
      });

      await expect(service.detail('tenant-a', 'conv-b')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a non-existent conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.detail('tenant-a', 'ghost-id')).rejects.toThrow(NotFoundException);
    });

    it('allows Tenant A to access its own conversation', async () => {
      const conv = {
        id: 'conv-a',
        tenantId: 'tenant-a',
        status: ConvStatus.OPEN,
        mode: ConversationMode.AI,
      };
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const result = await service.detail('tenant-a', 'conv-a');

      expect(result).toMatchObject({ id: 'conv-a' });
    });
  });

  // ── Critério 3: atendedor responde → entregue no canal ────────────────

  describe('sendAgentMessage', () => {
    const baseConv = {
      id: 'conv-1',
      tenantId: 'tenant-1',
      status: ConvStatus.OPEN,
      mode: ConversationMode.HUMAN,
    };

    it('delivers reply through the channel provider and emits conversation:message', async () => {
      const message = {
        id: 'msg-h1',
        content: 'Posso ajudar com isso.',
        sender: SenderType.AGENT,
        createdAt: new Date(),
      };
      mockPrisma.conversation.findUnique.mockResolvedValue(baseConv);
      mockPrisma.conversation.update.mockResolvedValue(baseConv);
      mockMessaging.sendViaConversation.mockResolvedValue(message);

      const result = await service.sendAgentMessage('tenant-1', 'conv-1', 'Posso ajudar com isso.');

      expect(mockMessaging.sendViaConversation).toHaveBeenCalledWith(
        'conv-1',
        'Posso ajudar com isso.',
        SenderType.AGENT,
      );
      expect(mockGateway.emitMessage).toHaveBeenCalledWith(
        'tenant-1',
        'conv-1',
        expect.objectContaining({ conversationId: 'conv-1' }),
      );
      expect(result).toEqual(message);
    });

    it('throws BadRequestException when conversation is RESOLVED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        ...baseConv,
        status: ConvStatus.RESOLVED,
      });

      await expect(
        service.sendAgentMessage('tenant-1', 'conv-1', 'texto'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── updateMode persists and emits ────────────────────────────────────

  describe('updateMode', () => {
    it('switches to HUMAN and notifies Socket.io panel', async () => {
      const conv = {
        id: 'conv-2',
        tenantId: 'tenant-1',
        status: ConvStatus.OPEN,
        mode: ConversationMode.AI,
      };
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      mockPrisma.conversation.update.mockResolvedValue({
        ...conv,
        mode: ConversationMode.HUMAN,
      });

      await service.updateMode('tenant-1', 'conv-2', { mode: ConversationMode.HUMAN });

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { mode: ConversationMode.HUMAN } }),
      );
      expect(mockGateway.emitUpdated).toHaveBeenCalled();
    });
  });
});
