import {Matches, Min, IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
    @ApiProperty({example: 'Cold Pressed Ginger Shot 250ml', minLength:2})
    @IsString()
    @MinLength(2)
    name!:string

    @ApiPropertyOptional({ example: 'High protein blend formulated for laying hens'})
    @IsOptional()
    @IsString()
    description?:string

    @ApiProperty({ example: 4999, description:'Price in minor units'})
    @IsInt()
    @Min(0)
    price!:number

    @ApiPropertyOptional({ example: 100, default: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    stock?: number

    @ApiPropertyOptional({ example: true, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?:boolean

    @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9i0j1', description: 'ID of the vendor you own' })
    @IsString()
    vendorId!:string;

    @ApiPropertyOptional({ example: 'cold-pressed-ginger-shot-250ml', description: 'Auto-derived from name if omitted' })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,{
        message:'slug must contain only lowercase letters, numbers, and hyphens'
    })
    slug?:string

    @ApiPropertyOptional({ example: 'clx9z8y7x6w5v4u3t2s1r0q9' })
    @IsOptional()
    @IsString()
    categoryId?:string;


}
