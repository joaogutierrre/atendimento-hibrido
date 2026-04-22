import { Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { MessagingService } from './messaging.service';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramProvider } from './telegram/telegram.provider';
import { WhatsAppWebhookController } from './whatsapp/whatsapp.controller';
import { WhatsAppProvider } from './whatsapp/whatsapp.provider';

@Module({
  imports: [SocketModule],
  controllers: [TelegramWebhookController, WhatsAppWebhookController],
  providers: [TelegramProvider, WhatsAppProvider, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
