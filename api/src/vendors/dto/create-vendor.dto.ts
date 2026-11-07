import { IsOptional, IsString, Matches, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVendorDto {
    @ApiProperty({ example: 'Green Valley Nutrition', minLength: 2 })
    @IsString()
    @MinLength(2)
    name!: string

    @ApiPropertyOptional({ example: 'Family-run supplier of wholefoods and animal nutrition since 1998' })
    @IsOptional()
    @IsString()
    description?:string

    @ApiPropertyOptional({ example: 'green-valley-nutrition', description: 'Auto-derived from name if omitted' })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,{
        message:'slug must contain only lowercase letters, numbers, and hyphens'
    })
    slug?:string;
    
}
