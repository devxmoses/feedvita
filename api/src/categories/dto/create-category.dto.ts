import { IsOptional, IsString, Matches, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Beverages', minLength: 2 })
    @IsString()
    @MinLength(2)
    name!: string

    @ApiPropertyOptional({ example: 'beverages', description: 'Auto-derived from name if omitted' })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'slug must contain only lowercase letters, numbers, and hyphens',
    })
    slug?: string;

    @ApiPropertyOptional({ example: 'clx1a2b3c4d5e6f7g8h9i0j1', description: 'Parent category, for subcategories' })
    @IsOptional()
    @IsString()
    parentId?:string
}
