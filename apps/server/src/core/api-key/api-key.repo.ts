import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  ApiKey,
  InsertableApiKey,
} from '@docmost/db/types/entity.types';

/**
 * 社区版原创实现的 API Key 数据访问层 (对应企业版被抽走的功能).
 * 表结构 (api_keys) 已存在于社区版迁移中, 这里只补 CRUD.
 */
@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(data: InsertableApiKey): Promise<ApiKey> {
    return this.db
      .insertInto('apiKeys')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(id: string, workspaceId: string): Promise<ApiKey | undefined> {
    return this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByCreator(
    creatorId: string,
    workspaceId: string,
  ): Promise<ApiKey[]> {
    return this.db
      .selectFrom('apiKeys')
      .select(['id', 'name', 'creatorId', 'workspaceId', 'expiresAt', 'lastUsedAt', 'createdAt'])
      .where('creatorId', '=', creatorId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .execute() as unknown as ApiKey[];
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
