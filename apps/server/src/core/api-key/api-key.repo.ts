import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { ApiKey, InsertableApiKey } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

/**
 * 社区版原创实现的 API Key 数据访问层 (对应企业版被抽走的功能).
 * 表结构 (api_keys) 已存在于社区版迁移中, 这里只补 CRUD + 分页 + creator 关联.
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

  /** 单行 + creator, 用于 create/update 后返回给前端 */
  async findByIdWithCreator(id: string, workspaceId: string) {
    return this.db
      .selectFrom('apiKeys')
      .select((eb) => [
        'id',
        'name',
        'creatorId',
        'workspaceId',
        'expiresAt',
        'lastUsedAt',
        'createdAt',
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'apiKeys.creatorId'),
        ).as('creator'),
      ])
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  /** 分页列表; creatorId 为空表示工作区全部(管理员视图) */
  async list(opts: {
    workspaceId: string;
    creatorId?: string;
    pagination: PaginationOptions;
  }) {
    let query = this.db
      .selectFrom('apiKeys')
      .select((eb) => [
        'id',
        'name',
        'creatorId',
        'workspaceId',
        'expiresAt',
        'lastUsedAt',
        'createdAt',
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'apiKeys.creatorId'),
        ).as('creator'),
      ])
      .where('workspaceId', '=', opts.workspaceId)
      .where('deletedAt', 'is', null);

    if (opts.creatorId) {
      query = query.where('creatorId', '=', opts.creatorId);
    }

    return executeWithCursorPagination(query, {
      perPage: opts.pagination.limit,
      cursor: opts.pagination.cursor,
      beforeCursor: opts.pagination.beforeCursor,
      fields: [
        { expression: 'createdAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (c) => ({ createdAt: c.createdAt, id: c.id }),
    });
  }

  async updateName(id: string, workspaceId: string, name: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ name, updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .execute();
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
