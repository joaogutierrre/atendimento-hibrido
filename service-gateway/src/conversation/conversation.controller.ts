import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.conversation.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
