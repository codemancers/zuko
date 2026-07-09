// Apollo integration DTOs — OAuth is now handled by Nango
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';

export class ActivateApolloDto {
  @ApiProperty({
    description:
      'Nango connection ID returned by the frontend OAuth flow. Nango generates these server-side (UUIDs); ownership is verified against the connection\'s end user organisation.',
    example: 'c6c6c195-154c-45f2-a734-f2e731e4196d',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'nangoConnectionId contains invalid characters',
  })
  nangoConnectionId!: string;
}
