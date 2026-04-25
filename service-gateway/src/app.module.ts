import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { UserAwareThrottlerGuard } from './auth/guards/user-throttler.guard';
import { TenantInterceptor } from './auth/interceptors/tenant.interceptor';
import { AgentRelayModule } from './agent-relay/agent-relay.module';
import { ConversationModule } from './conversation/conversation.module';
import { HealthController } from './health/health.controller';
import { MessagingModule } from './messaging/messaging.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(config.get<string>('THROTTLE_TTL') ?? '60000', 10),
            limit: parseInt(config.get<string>('THROTTLE_LIMIT') ?? '120', 10),
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    SocketModule,
    AgentRelayModule,
    ConversationModule,
    MessagingModule,
    TenantModule,
  ],
  controllers: [HealthController],
  providers: [
    // JwtAuthGuard first so req.user is set before throttler evaluates the key
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
