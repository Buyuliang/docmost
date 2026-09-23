import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** 可选有效期, 如 "30d" / "90d" / "1y"; 不填则不过期 */
  @IsOptional()
  @IsString()
  expiresIn?: string;
}

export class ApiKeyIdDto {
  @IsString()
  apiKeyId: string;
}
