import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyRepo } from './api-key.repo';
import { TokenModule } from '../auth/token.module';

/**
 * 社区版原创实现的 API Key 模块.
 * UserRepo / WorkspaceRepo 来自全局 DatabaseModule; TokenService 来自 TokenModule.
 * 导出 ApiKeyService 供 jwt.strategy 通过 ModuleRef 取用.
 */
@Module({
  imports: [TokenModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyRepo],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
