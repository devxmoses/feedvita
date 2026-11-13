import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Segment } from '../../../generated/prisma/enums';

export class CreateSpeciesDto {
    @ApiProperty({ example: 'Alpaca', minLength: 2, maxLength: 60 })
    @IsString()
    @MinLength(2)
    @MaxLength(60)
    name!: string;

    @ApiProperty({ enum: Segment, example: Segment.LIVESTOCK })
    @IsEnum(Segment)
    segment!: Segment;
}
