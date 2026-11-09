import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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

    @ApiPropertyOptional({ enum: PRODUCT_SORT_FIELDS, default: 'createdAt' })
    @IsOptional()
    @IsIn(PRODUCT_SORT_FIELDS)
    sortBy: ProductSortField = 'createdAt';
}
