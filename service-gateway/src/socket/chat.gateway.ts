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

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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
    if (!this.userOf(client)) return { ok: false };
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
    this.server.to(tenantRoom(tenantId)).emit('conversation:message', payload);
    this.server
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
