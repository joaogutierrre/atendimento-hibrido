import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

interface RoomPayload {
  conversationId: string;
}

function tenantRoom(tenantId: string) {
  return `tenant:${tenantId}`;
}
function userRoom(userId: string) {
  return `user:${userId}`;
}
function conversationRoom(id: string) {
  return `conversation:${id}`;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('ChatGateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        this.bearerFromHeader(client);
      if (!token) throw new Error('Missing token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      (client.data as Record<string, unknown>).user = payload;
      await client.join(tenantRoom(payload.tenantId));
      await client.join(userRoom(payload.sub));

      this.logger.log(
        `socket connected id=${client.id} tenant=${payload.tenantId} user=${payload.sub}`,
      );
    } catch (err) {
      this.logger.warn(`socket auth failed id=${client.id}: ${(err as Error).message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`socket disconnected id=${client.id}`);
  }

  private bearerFromHeader(client: Socket): string | undefined {
    const raw = client.handshake.headers['authorization'];
    if (!raw || typeof raw !== 'string' || !raw.startsWith('Bearer ')) return undefined;
    return raw.slice('Bearer '.length);
  }

  private userOf(client: Socket): JwtPayload | undefined {
    return (client.data as Record<string, unknown>).user as JwtPayload | undefined;
  }

  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomPayload,
  ) {
    const user = this.userOf(client);
    if (!user) return { ok: false, error: 'Unauthorized' };

    const conv = await this.prisma.conversation.findUnique({
      where: { id: body.conversationId },
      select: { tenantId: true },
    });
    if (!conv || conv.tenantId !== user.tenantId) {
      return { ok: false, error: 'Forbidden' };
    }

    await client.join(conversationRoom(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('conversation:leave')
  async onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomPayload,
  ) {
    await client.leave(conversationRoom(body.conversationId));
    return { ok: true };
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: RoomPayload,
  ) {
    const user = this.userOf(client);
    if (!user) return;
    client.to(conversationRoom(body.conversationId)).emit('typing', {
      conversationId: body.conversationId,
      userId: user.sub,
    });
  }

  // ── Helpers usados pelos serviços HTTP ─────────────────────────────
  emitNew(tenantId: string, payload: unknown) {
    this.server.to(tenantRoom(tenantId)).emit('conversation:new', payload);
  }
  emitMessage(tenantId: string, conversationId: string, payload: unknown) {
    // Chained .to() emits to the union of rooms — sockets in both rooms
    // (e.g., panel watching the tenant feed AND zoomed into the conversation)
    // receive the event once. Two separate .emit() calls would duplicate.
    this.server
      .to(tenantRoom(tenantId))
      .to(conversationRoom(conversationId))
      .emit('conversation:message', payload);
  }
  emitEscalated(tenantId: string, payload: unknown) {
    this.server.to(tenantRoom(tenantId)).emit('conversation:escalated', payload);
  }
  emitUpdated(tenantId: string, payload: unknown) {
    this.server.to(tenantRoom(tenantId)).emit('conversation:updated', payload);
  }
}
