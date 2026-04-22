import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConvStatus, ConversationMode, Prisma, SenderType } from '@prisma/client';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../socket/chat.gateway';
import { AssignDto } from './dto/assign.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { UpdateModeDto } from './dto/update-mode.dto';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly gateway: ChatGateway,
  ) {}

  async list(tenantId: string, query: ListConversationsDto) {
    const where: Prisma.ConversationWhereInput = { tenantId };
    if (query.status) where.status = query.status;
    if (query.mode) where.mode = query.mode;
    if (query.branchId) where.branchId = query.branchId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: query.take ?? 20,
        skip: query.skip ?? 0,
        include: {
          channel: { select: { id: true, type: true, displayName: true } },
          assignedUser: { select: { id: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { items, total, take: query.take ?? 20, skip: query.skip ?? 0 };
  }

  private async loadOwned(tenantId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.tenantId !== tenantId) throw new ForbiddenException('Not your conversation');
    return conv;
  }

  async detail(tenantId: string, id: string) {
    const conv = await this.loadOwned(tenantId, id);
    const [full, messages] = await Promise.all([
      this.prisma.conversation.findUnique({
        where: { id: conv.id },
        include: {
          channel: { select: { id: true, type: true, displayName: true } },
          branch: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, email: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return { ...full, messages: messages.reverse() };
  }

  async updateMode(tenantId: string, id: string, dto: UpdateModeDto) {
    await this.loadOwned(tenantId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { mode: dto.mode },
    });
    this.gateway.emitUpdated(tenantId, {
      conversationId: updated.id,
      tenantId,
      mode: updated.mode,
      status: updated.status,
    });
    return updated;
  }

  async assign(tenantId: string, id: string, dto: AssignDto) {
    await this.loadOwned(tenantId, id);
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!user || user.tenantId !== tenantId) {
        throw new ForbiddenException('Assignee must belong to the same tenant');
      }
    }
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        assignedUserId: dto.userId ?? null,
        mode: dto.userId ? ConversationMode.HUMAN : ConversationMode.AI,
      },
    });
    this.gateway.emitUpdated(tenantId, {
      conversationId: updated.id,
      tenantId,
      mode: updated.mode,
      status: updated.status,
      assignedUserId: updated.assignedUserId,
    });
    return updated;
  }

  async resolve(tenantId: string, id: string) {
    await this.loadOwned(tenantId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { status: ConvStatus.RESOLVED },
    });
    this.gateway.emitUpdated(tenantId, {
      conversationId: updated.id,
      tenantId,
      mode: updated.mode,
      status: updated.status,
    });
    return updated;
  }

  async sendAgentMessage(tenantId: string, id: string, content: string) {
    const conv = await this.loadOwned(tenantId, id);
    if (conv.status === ConvStatus.RESOLVED) {
      throw new BadRequestException('Cannot send to a resolved conversation');
    }
    const message = await this.messaging.sendViaConversation(
      conv.id,
      content,
      SenderType.AGENT,
    );
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });
    this.gateway.emitMessage(tenantId, conv.id, {
      conversationId: conv.id,
      tenantId,
      message,
    });
    return message;
  }
}
