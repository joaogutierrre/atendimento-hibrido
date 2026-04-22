import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramProvider } from './telegram/telegram.provider';

@Module({
  controllers: [TelegramWebhookController],
  providers: [TelegramProvider, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
