import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateVendorDto {
    @IsString()
    @MinLength(2)
    name!: string

    @IsOptional()
    @IsString()
    description?:string

    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,{
        message:'slug must contain only lowercase letters, numbers, and hyphens'
    })
    slug?:string;
    
}
