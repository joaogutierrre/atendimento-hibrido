import { Module } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { SocketModule } from '../socket/socket.module';
import { AgentRelayService } from './agent-relay.service';

@Module({
  imports: [MessagingModule, SocketModule],
  providers: [AgentRelayService],
})
export class AgentRelayModule {}
