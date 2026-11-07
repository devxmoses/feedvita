import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9i0j1', description: 'You must have a DELIVERED order containing this product' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

    @ApiPropertyOptional({ example: 'Arrived cold and tasted fresh, good value for the pack size.' })
  @IsOptional()
  @IsString()
  comment?: string;
}
