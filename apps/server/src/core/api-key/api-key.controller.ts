import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyIdDto,
} from './dto/api-key.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

function isWorkspaceAdmin(user: User): boolean {
  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'owner';
}

@UseGuards(JwtAuthGuard)
// 管理 API key 必须是交互式登录会话, 不能用 api key 令牌自我增殖
@RequireSessionAuth()
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  // 列表: adminView(且为管理员)时返回整个工作区, 否则仅本人
  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const adminView = (pagination as any).adminView && isWorkspaceAdmin(user);
    return this.apiKeyService.list({
      workspaceId: workspace.id,
      creatorId: adminView ? undefined : user.id,
      pagination,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // 返回对象含 token 字段, 只此一次
    return this.apiKeyService.create({
      name: dto.name,
      expiresAt: dto.expiresAt,
      user,
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateApiKeyDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.updateName(dto.apiKeyId, workspace.id, dto.name);
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
