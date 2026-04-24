import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisChannels } from '../redis/redis.constants';
import { RedisPublisher } from '../redis/redis.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { UpsertAgentConfigDto } from './dto/upsert-config.dto';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly redis: RedisPublisher,
  ) {}

  // ── AgentConfig ────────────────────────────────────────────────────
  getConfig(tenantId: string) {
    return this.prisma.agentConfig.findUnique({ where: { tenantId } });
  }

  upsertConfig(tenantId: string, dto: UpsertAgentConfigDto) {
    const data: Prisma.AgentConfigUncheckedCreateInput = {
      tenantId,
      systemPrompt: dto.systemPrompt,
      tone: dto.tone ?? 'professional',
      escalateOnWords: dto.escalateOnWords ?? [],
      offHoursMessage: dto.offHoursMessage ?? null,
      workingHoursStart: dto.workingHoursStart ?? 8,
      workingHoursEnd: dto.workingHoursEnd ?? 18,
    };
    return this.prisma.agentConfig.upsert({
      where: { tenantId },
      create: data,
      update: {
        systemPrompt: dto.systemPrompt,
        tone: dto.tone,
        escalateOnWords: dto.escalateOnWords,
        offHoursMessage: dto.offHoursMessage,
        workingHoursStart: dto.workingHoursStart,
        workingHoursEnd: dto.workingHoursEnd,
      },
    });
  }

  // ── Branch ─────────────────────────────────────────────────────────
  listBranches(tenantId: string) {
    return this.prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  createBranch(tenantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async deleteBranch(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.tenantId !== tenantId) throw new ForbiddenException('Not your branch');
    await this.prisma.branch.delete({ where: { id } });
  }

  // ── MessagingChannel ───────────────────────────────────────────────
  listChannels(tenantId: string) {
    return this.prisma.messagingChannel.findMany({
      where: { tenantId },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async createChannel(tenantId: string, dto: CreateChannelDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch || branch.tenantId !== tenantId) {
      throw new ForbiddenException('Branch does not belong to this tenant');
    }
    const channel = await this.prisma.messagingChannel.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        type: dto.type,
        identifier: dto.identifier,
        displayName: dto.displayName,
        isActive: dto.isActive ?? true,
      },
    });
    try {
      await this.messaging.setupChannel(channel);
    } catch (err) {
      this.logger.warn(
        `Channel ${channel.id} criado mas setup falhou: ${(err as Error).message}`,
      );
    }
    return channel;
  }

  async updateChannel(tenantId: string, id: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.messagingChannel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.tenantId !== tenantId) throw new ForbiddenException('Not your channel');
    return this.prisma.messagingChannel.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async deleteChannel(tenantId: string, id: string) {
    const channel = await this.prisma.messagingChannel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.tenantId !== tenantId) throw new ForbiddenException('Not your channel');
    await this.prisma.messagingChannel.delete({ where: { id } });
  }

  // ── KnowledgeChunk ─────────────────────────────────────────────────
  listKnowledge(tenantId: string) {
    // embedding is Unsupported("vector") — use raw query to expose embeddingReady boolean
    return this.prisma.$queryRaw<
      Array<{ id: string; content: string; sourceUrl: string | null; createdAt: Date; embeddingReady: boolean }>
    >`
      SELECT id, content, "sourceUrl", "createdAt",
             (embedding IS NOT NULL) AS "embeddingReady"
      FROM "KnowledgeChunk"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "createdAt" DESC
    `;
  }

  async createKnowledge(tenantId: string, dto: CreateKnowledgeDto) {
    const chunk = await this.prisma.knowledgeChunk.create({
      data: { tenantId, content: dto.content, sourceUrl: dto.sourceUrl },
      select: { id: true, content: true, sourceUrl: true, createdAt: true },
    });
    await this.redis.xadd(RedisChannels.knowledgeChunkCreated, { chunkId: chunk.id, tenantId });
    return chunk;
  }

  async deleteKnowledge(tenantId: string, id: string) {
    const chunk = await this.prisma.knowledgeChunk.findUnique({ where: { id } });
    if (!chunk) throw new NotFoundException('Knowledge chunk not found');
    if (chunk.tenantId !== tenantId) throw new ForbiddenException('Not your chunk');
    await this.prisma.knowledgeChunk.delete({ where: { id } });
  }

  // ── Team (User) ────────────────────────────────────────────────────
  listTeam(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        branches: { select: { branch: { select: { id: true, name: true } } } },
      },
    });
  }

  async createUser(tenantId: string, dto: CreateUserDto) {
    if (dto.branchIds?.length) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: dto.branchIds }, tenantId },
        select: { id: true },
      });
      if (branches.length !== dto.branchIds.length) {
        throw new ForbiddenException('One or more branches do not belong to this tenant');
      }
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        password: hashed,
        role: dto.role,
        branches: dto.branchIds?.length
          ? { create: dto.branchIds.map((branchId) => ({ branchId })) }
          : undefined,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  async deleteUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.tenantId !== tenantId) throw new ForbiddenException('Not your user');
    await this.prisma.userBranch.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });
  }
}
