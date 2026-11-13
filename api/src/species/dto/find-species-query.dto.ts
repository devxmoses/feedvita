import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Segment } from '../../../generated/prisma/enums';

export class FindSpeciesQueryDto {
    @ApiPropertyOptional({ enum: Segment, description: 'Only species in this segment' })
    @IsOptional()
    @IsEnum(Segment)
    segment?: Segment;
}
