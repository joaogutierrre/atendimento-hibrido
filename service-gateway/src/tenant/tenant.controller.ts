import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpsertAgentConfigDto } from './dto/upsert-config.dto';
import { TenantService } from './tenant.service';

@Roles(Role.ADMIN)
@Controller('tenant')
export class TenantController {
  constructor(private readonly svc: TenantService) {}

  // ── Config ─────────────────────────────────────────────────────────
  @Get('config')
  getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getConfig(user.tenantId);
  }

  @Put('config')
  upsertConfig(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertAgentConfigDto) {
    return this.svc.upsertConfig(user.tenantId, dto);
  }

  // ── Branches ───────────────────────────────────────────────────────
  @Get('branches')
  listBranches(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listBranches(user.tenantId);
  }

  @Post('branches')
  createBranch(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBranchDto) {
    return this.svc.createBranch(user.tenantId, dto);
  }

  @Delete('branches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBranch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteBranch(user.tenantId, id);
  }

  // ── Channels ───────────────────────────────────────────────────────
  @Get('channels')
  listChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listChannels(user.tenantId);
  }

  @Post('channels')
  createChannel(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChannelDto) {
    return this.svc.createChannel(user.tenantId, dto);
  }

  @Patch('channels/:id')
  updateChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.svc.updateChannel(user.tenantId, id, dto);
  }

  @Delete('channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteChannel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteChannel(user.tenantId, id);
  }

  // ── Knowledge ──────────────────────────────────────────────────────
  @Get('knowledge')
  listKnowledge(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listKnowledge(user.tenantId);
  }

  @Post('knowledge')
  createKnowledge(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateKnowledgeDto) {
    return this.svc.createKnowledge(user.tenantId, dto);
  }

  @Delete('knowledge/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteKnowledge(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteKnowledge(user.tenantId, id);
  }

  // ── Team ───────────────────────────────────────────────────────────
  @Get('team')
  listTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listTeam(user.tenantId);
  }

  @Post('team')
  createUser(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.svc.createUser(user.tenantId, dto);
  }

  @Delete('team/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteUser(user.tenantId, id);
  }
}
