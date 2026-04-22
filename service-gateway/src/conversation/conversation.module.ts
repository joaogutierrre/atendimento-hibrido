import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { SocketModule } from '../socket/socket.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [MessagingModule, SocketModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
