import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto, ApiKeyIdDto } from './dto/api-key.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
// 管理 API key 必须是交互式登录会话, 不能用 api key 令牌自我增殖
@RequireSessionAuth()
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // token 字段只在此处返回一次, 请立即保存
    return this.apiKeyService.create({
      name: dto.name,
      user,
      workspaceId: workspace.id,
      expiresIn: dto.expiresIn,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.list(user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revoke(
    @Body() dto: ApiKeyIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.apiKeyService.revoke(dto.apiKeyId, workspace.id);
    return { success: true };
  }
}
