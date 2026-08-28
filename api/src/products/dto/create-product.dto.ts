import {Matches, Min, IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateProductDto {
    @IsString()
    @MinLength(2)
    name!:string

    @IsOptional()
    @IsString()
    description?:string

    @IsInt()
    @Min(0)
    price!:number

    @IsOptional()
    @IsInt()
    @Min(0)
    stock?: number

    @IsOptional()
    @IsBoolean()
    isActive?:boolean

    @IsString()
    vendorId!:string;

    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,{
        message:'slug must contain only lowercase letters, numbers, and hyphens'
    })
    slug?:string



}
