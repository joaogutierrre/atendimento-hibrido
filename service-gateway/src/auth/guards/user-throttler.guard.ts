import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedUser } from '../types';

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as AuthenticatedUser | undefined;
    // Authenticated requests: key by userId (shared across devices, fair per-user limit).
    // Public requests (login, refresh): key by IP.
    return user?.userId ?? String(req['ip'] ?? 'unknown');
  }
}
