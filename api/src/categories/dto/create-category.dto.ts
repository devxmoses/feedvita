import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateCategoryDto {
    @IsString()
    @MinLength(2)
    name!: string

    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'slug must contain only lowercase letters, numbers, and hyphens',
    })
    slug?: string;

    @IsOptional()
    @IsString()
    parentId?:string
}
