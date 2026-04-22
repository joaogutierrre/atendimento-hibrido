import { Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { MessagingService } from './messaging.service';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramProvider } from './telegram/telegram.provider';

@Module({
  imports: [SocketModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramProvider, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
