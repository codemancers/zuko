import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeApolloCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}
