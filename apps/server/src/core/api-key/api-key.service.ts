import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { StringValue } from 'ms';
import { ApiKeyRepo } from './api-key.repo';
import { TokenService } from '../auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { JwtApiKeyPayload } from '../auth/dto/jwt-payload';
import { isUserDisabled } from '../../common/helpers';
import { ApiKey, User } from '@docmost/db/types/entity.types';

/**
 * 社区版原创实现的 API Key 服务.
 * - create: 建行 + 用社区版已有的 TokenService.generateApiToken 签发 JWT(type=api_key), 明文只返回一次.
 * - validateApiKey: 供 jwt.strategy 在 type===api_key 时调用, 校验行有效并载入 user/workspace.
 * 令牌本身是自签 JWT(用 APP_SECRET 验签), 表里不存明文/hash, apiKeyId 指向行 id.
 */
@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async create(opts: {
    name?: string;
    user: User;
    workspaceId: string;
    expiresIn?: StringValue | number;
  }): Promise<{ apiKey: ApiKey; token: string }> {
    const row = await this.apiKeyRepo.insert({
      name: opts.name ?? null,
      creatorId: opts.user.id,
      workspaceId: opts.workspaceId,
    } as any);

    const token = await this.tokenService.generateApiToken({
      apiKeyId: row.id,
      user: opts.user,
      workspaceId: opts.workspaceId,
      // 不传则默认长期有效(10 年), 避免继承访问令牌的短有效期
      expiresIn: opts.expiresIn ?? '3650d',
    });

    // token 只在创建时返回一次, 之后无法再取
    return { apiKey: row, token };
  }

  async list(user: User, workspaceId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.findByCreator(user.id, workspaceId);
  }

  async revoke(id: string, workspaceId: string): Promise<void> {
    const existing = await this.apiKeyRepo.findById(id, workspaceId);
    if (!existing) throw new NotFoundException('API key not found');
    await this.apiKeyRepo.softDelete(id, workspaceId);
  }

  /** jwt.strategy 校验 type=api_key 令牌时调用 */
  async validateApiKey(
    payload: JwtApiKeyPayload,
  ): Promise<{ user: User; workspace: any }> {
    const record = await this.apiKeyRepo.findById(
      payload.apiKeyId,
      payload.workspaceId,
    );
    if (!record) throw new UnauthorizedException('Invalid or revoked API key');

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    const workspace = await this.workspaceRepo.findById(payload.workspaceId);
    if (!workspace) throw new UnauthorizedException();

    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    if (!user || isUserDisabled(user)) throw new UnauthorizedException();

    // 更新 last_used_at, 失败不影响鉴权
    this.apiKeyRepo.touchLastUsed(record.id).catch(() => void 0);

    return { user, workspace };
  }
}
