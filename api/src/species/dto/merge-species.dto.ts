import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MergeSpeciesDto {
    @ApiProperty({ description: 'The species to keep. Products move here, the other is deleted.' })
    @IsString()
    targetId!: string;
}
