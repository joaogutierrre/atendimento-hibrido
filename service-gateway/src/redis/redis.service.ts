import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_PUBLISHER, RedisChannel } from './redis.constants';

@Injectable()
export class RedisPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisher.name);

  constructor(@Inject(REDIS_PUBLISHER) private readonly client: Redis) {}

  async publish(channel: RedisChannel, payload: unknown): Promise<number> {
    const body = JSON.stringify(payload);
    const subscribers = await this.client.publish(channel, body);
    this.logger.debug(`published -> ${channel} (${subscribers} subscribers)`);
    return subscribers;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
