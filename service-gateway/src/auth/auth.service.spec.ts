import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockUser = {
  id: 'u-1',
  email: 'admin@test.com',
  name: 'Admin',
  password: '',
  role: 'ADMIN' as const,
  tenantId: 'tenant-1',
  branches: [],
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
const mockConfig = { get: jest.fn((key: string) => (key === 'JWT_REFRESH_EXPIRES_DAYS' ? '30' : undefined)) };

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const hashed = await bcrypt.hash('secret123', 10);
    mockUser.password = hashed;

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    svc = module.get(AuthService);
  });

  // ── login ───────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken + refreshToken on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await svc.login('admin@test.com', 'secret123');

      expect(result.accessToken).toBe('access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken).toHaveLength(64);
      expect(result.user.id).toBe('u-1');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(svc.login('x@x.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(svc.login('admin@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refresh ─────────────────────────────────────────────────────────

  describe('refresh', () => {
    const validStored = {
      id: 'rt-1',
      userId: 'u-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    };

    it('rotates token and returns new pair', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(validStored);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await svc.refresh('valid-token');

      expect(result.accessToken).toBe('access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
    });

    it('throws when token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(svc.refresh('ghost')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token is revoked', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({ ...validStored, revokedAt: new Date() });
      await expect(svc.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws when token is expired', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(svc.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ──────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await svc.logout('some-token');
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ token: 'some-token', revokedAt: null }) }),
      );
    });

    it('does not throw when token is unknown (idempotent)', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.logout('ghost-token')).resolves.toBeUndefined();
    });
  });
});
