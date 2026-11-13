import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Segment } from '../../../generated/prisma/enums';
import { Transform } from 'class-transformer';

export const PRODUCT_SORT_FIELDS = ['createdAt', 'price', 'name', 'stock'] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export class FindProductsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Only products belonging to this vendor' })
    @IsOptional()
    @IsString()
    vendorId?: string;

    @ApiPropertyOptional({ description: 'Only products in this category' })
    @IsOptional()
    @IsString()
    categoryId?: string;

        @ApiPropertyOptional({
        enum: Segment,
        isArray: true,
        description: 'Repeat the key to widen: ?segments=PET&segments=LIVESTOCK matches either',
    })
    @IsOptional()
    // one ?segments=PET arrives as a string, two arrive as an array - normalise to an array
    @Transform(({ value }) => (value === undefined ? value : ([] as string[]).concat(value)))
    @IsArray()
    @IsEnum(Segment, { each: true })
    segments?: Segment[];

    @ApiPropertyOptional({ description: 'Only products suited to this species' })
    @IsOptional()
    @IsString()
    speciesId?: string;


    @ApiPropertyOptional({ enum: PRODUCT_SORT_FIELDS, default: 'createdAt' })
    @IsOptional()
    @IsIn(PRODUCT_SORT_FIELDS)
    sortBy: ProductSortField = 'createdAt';
}
