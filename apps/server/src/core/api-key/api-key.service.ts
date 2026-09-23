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
import { User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

/**
 * 社区版原创实现的 API Key 服务 (非派生自企业版 ee/ 代码).
 * 令牌是自签 JWT(APP_SECRET 验签, type=api_key, 内含 apiKeyId 指向行), 表里不存明文.
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
    name: string;
    expiresAt?: string;
    user: User;
    workspaceId: string;
  }) {
    const expiresAtDate = opts.expiresAt ? new Date(opts.expiresAt) : null;

    const row = await this.apiKeyRepo.insert({
      name: opts.name,
      creatorId: opts.user.id,
      workspaceId: opts.workspaceId,
      expiresAt: expiresAtDate,
    } as any);

    // JWT 有效期: 有 expiresAt 则算到那天的秒数, 否则默认 10 年
    let expiresIn: StringValue | number = '3650d';
    if (expiresAtDate) {
      const secs = Math.floor((expiresAtDate.getTime() - Date.now()) / 1000);
      expiresIn = secs > 0 ? secs : 60;
    }

    const token = await this.tokenService.generateApiToken({
      apiKeyId: row.id,
      user: opts.user,
      workspaceId: opts.workspaceId,
      expiresIn,
    });

    const withCreator = await this.apiKeyRepo.findByIdWithCreator(
      row.id,
      opts.workspaceId,
    );

    // token 只在创建时返回这一次
    return { ...withCreator, token };
  }

  async list(opts: {
    workspaceId: string;
    creatorId?: string;
    pagination: PaginationOptions;
  }) {
    return this.apiKeyRepo.list(opts);
  }

  async updateName(apiKeyId: string, workspaceId: string, name: string) {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) throw new NotFoundException('API key not found');
    await this.apiKeyRepo.updateName(apiKeyId, workspaceId, name);
    return this.apiKeyRepo.findByIdWithCreator(apiKeyId, workspaceId);
  }

  async revoke(apiKeyId: string, workspaceId: string): Promise<void> {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) throw new NotFoundException('API key not found');
    await this.apiKeyRepo.softDelete(apiKeyId, workspaceId);
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

    this.apiKeyRepo.touchLastUsed(record.id).catch(() => void 0);

    return { user, workspace };
  }
}
