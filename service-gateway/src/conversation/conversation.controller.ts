import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { ConversationService } from './conversation.service';
import { AssignDto } from './dto/assign.dto';
import { ListConversationsDto } from './dto/list-conversations.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateModeDto } from './dto/update-mode.dto';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly svc: ConversationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListConversationsDto) {
    return this.svc.list(user.tenantId, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.detail(user.tenantId, id);
  }

  @Patch(':id/mode')
  updateMode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateModeDto,
  ) {
    return this.svc.updateMode(user.tenantId, id, dto);
  }

  @Patch(':id/assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.svc.assign(user.tenantId, id, dto);
  }

  @Patch(':id/resolve')
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.resolve(user.tenantId, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.svc.sendAgentMessage(user.tenantId, id, dto.content);
  }
}
