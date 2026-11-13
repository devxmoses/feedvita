import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const VENDOR_SORT_FIELDS = ['createdAt', 'name'] as const;
export type VendorSortField = (typeof VENDOR_SORT_FIELDS)[number];

export class FindVendorsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: VENDOR_SORT_FIELDS, default: 'createdAt' })
    @IsOptional()
    @IsIn(VENDOR_SORT_FIELDS)
    sortBy: VendorSortField = 'createdAt';
}
