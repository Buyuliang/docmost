import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** 可选到期日期(ISO 字符串); 不填则长期有效 */
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsString()
  apiKeyId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ApiKeyIdDto {
  @IsString()
  apiKeyId: string;
}
