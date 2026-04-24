import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { RedisPublisher } from '../redis/redis.service';

describe('TenantService', () => {
  let svc: TenantService;

  const mockPrisma = {
    messagingChannel: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    knowledgeChunk: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    branch: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    userBranch: { deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const mockMessaging = { setupChannel: jest.fn() };
  const mockRedis = { xadd: jest.fn().mockResolvedValue('1-0') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: RedisPublisher, useValue: mockRedis },
      ],
    }).compile();
    svc = module.get(TenantService);
  });

  // ── PATCH /tenant/channels/:id ──────────────────────────────────────

  describe('updateChannel', () => {
    const channel = { id: 'ch-1', tenantId: 'tenant-1', isActive: true, displayName: 'Old' };

    it('toggles isActive to false', async () => {
      mockPrisma.messagingChannel.findUnique.mockResolvedValue(channel);
      mockPrisma.messagingChannel.update.mockResolvedValue({ ...channel, isActive: false });

      const result = await svc.updateChannel('tenant-1', 'ch-1', { isActive: false });

      expect(mockPrisma.messagingChannel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
      expect(result.isActive).toBe(false);
    });

    it('updates displayName', async () => {
      mockPrisma.messagingChannel.findUnique.mockResolvedValue(channel);
      mockPrisma.messagingChannel.update.mockResolvedValue({ ...channel, displayName: 'New Name' });

      await svc.updateChannel('tenant-1', 'ch-1', { displayName: 'New Name' });

      expect(mockPrisma.messagingChannel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ displayName: 'New Name' }) }),
      );
    });

    it('throws NotFoundException when channel does not exist', async () => {
      mockPrisma.messagingChannel.findUnique.mockResolvedValue(null);
      await expect(svc.updateChannel('tenant-1', 'ghost', {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when channel belongs to another tenant', async () => {
      mockPrisma.messagingChannel.findUnique.mockResolvedValue({ ...channel, tenantId: 'other' });
      await expect(svc.updateChannel('tenant-1', 'ch-1', {})).rejects.toThrow(ForbiddenException);
    });
  });

  // ── GET /tenant/knowledge — embeddingReady ──────────────────────────

  describe('listKnowledge', () => {
    it('returns embeddingReady=true for processed chunks', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'ck-1', content: 'FAQ', sourceUrl: null, createdAt: new Date(), embeddingReady: true },
        { id: 'ck-2', content: 'Novo', sourceUrl: null, createdAt: new Date(), embeddingReady: false },
      ]);

      const result = await svc.listKnowledge('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].embeddingReady).toBe(true);
      expect(result[1].embeddingReady).toBe(false);
    });

    it('does NOT return embedding vector (never in select)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'ck-1', content: 'x', sourceUrl: null, createdAt: new Date(), embeddingReady: true },
      ]);

      const result = await svc.listKnowledge('tenant-1');

      expect((result[0] as any).embedding).toBeUndefined();
    });
  });

  // ── Sem vazamento de senha ──────────────────────────────────────────

  describe('listTeam — no password leak', () => {
    it('Prisma select nunca pede o campo password', async () => {
      const rows = [{ id: 'u-1', email: 'a@b.com', name: 'A', role: 'AGENT', createdAt: new Date(), branches: [] }];
      mockPrisma.user.findMany.mockResolvedValue(rows);

      const result = await svc.listTeam('tenant-1');

      // Verifica que o select passado ao Prisma não inclui password
      const selectArg = mockPrisma.user.findMany.mock.calls[0][0].select;
      expect(selectArg.password).toBeUndefined();

      // Verifica que a resposta também não contém password
      result.forEach((r) => expect((r as any).password).toBeUndefined());
    });
  });
});
