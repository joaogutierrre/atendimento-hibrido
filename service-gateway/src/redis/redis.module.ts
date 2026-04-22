import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_PUBLISHER } from './redis.constants';
import { RedisPublisher } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
        const logger = new Logger('RedisPublisher');
        client.on('connect', () => logger.log(`connected ${url}`));
        client.on('error', (err) => logger.error(`redis error: ${err.message}`));
        return client;
      },
    },
    RedisPublisher,
  ],
  exports: [RedisPublisher],
})
export class RedisModule {}
