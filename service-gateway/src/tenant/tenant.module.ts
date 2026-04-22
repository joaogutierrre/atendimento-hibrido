import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [MessagingModule],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
