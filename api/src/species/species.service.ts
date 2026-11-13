import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';
import { FindSpeciesQueryDto } from './dto/find-species-query.dto';

@Injectable()
export class SpeciesService {
    constructor(private readonly prisma:PrismaService){}

    findAllApproved(query:FindSpeciesQueryDto){
        return this.prisma.species.findMany({
            where:{
                isApproved:true,
                ...(query.segment?{segment:query.segment}:{}),
            },
            orderBy:{name:'asc'},
        });
    }

    findMine(userId:string){
        return this.prisma.species.findMany({
            where:{suggestedById:userId},
            orderBy:{createdAt:'desc'},
        });
    }

    findPending(){
        return this.prisma.species.findMany({
            where:{isApproved:false},
            orderBy:{createdAt:'asc'},
        });
    }

    async findOne(id:string){
        const species = await this.prisma.species.findUnique({where:{id}});
        if(!species) throw new NotFoundException(`Species with ID ${id} not found`);
        return species;
    }

     async suggest(userId:string, createSpeciesDto:CreateSpeciesDto){
        const name = createSpeciesDto.name.trim();
        const slug = slugify(name);

        if(!slug){
            throw new BadRequestException('name must contain at least one letter or number');
        }

        return this.prisma.species.upsert({
            where:{slug},
            update:{},
            create:{
                name,
                slug,
                segment:createSpeciesDto.segment,
                suggestedById:userId,
            },
        });
    }

    async approve(id:string){
        await this.findOne(id);
        return this.prisma.species.update({
            where:{id},
            data:{isApproved:true},
        });
    }

    async update(id:string, updateSpeciesDto:UpdateSpeciesDto){
        await this.findOne(id);

        const {name, segment} = updateSpeciesDto;
        return this.prisma.species.update({
            where:{id},
            data:{
                ...(name?{name:name.trim(), slug:slugify(name)}:{}),
                ...(segment?{segment}:{}),
            },
        });
    }

    async merge(sourceId:string, targetId:string){
        if(sourceId === targetId){
            throw new BadRequestException('Cannot merge a species into itself');
        }

        await this.findOne(sourceId);
        await this.findOne(targetId);

        return this.prisma.$transaction(async (tx)=>{
            const products = await tx.product.findMany({
                where:{species:{some:{id:sourceId}}},
                select:{id:true},
            });

            for(const product of products){
                await tx.product.update({
                    where:{id:product.id},
                    data:{
                        species:{
                            // connect is idempotent for a link that already exists,
                            // which matters for a product tagged with both species
                            connect:{id:targetId},
                            disconnect:{id:sourceId},
                        },
                    },
                });
            }

            await tx.species.delete({where:{id:sourceId}});

            return {
                merged:products.length,
                target:await tx.species.findUniqueOrThrow({where:{id:targetId}}),
            };
        });
    }

    async remove(id:string){
        await this.findOne(id);

        const inUse = await this.prisma.product.count({
            where:{species:{some:{id}}},
        });

        if(inUse){
            throw new ConflictException(
                `Species is still used by ${inUse} product(s). Merge it into another species instead.`,
            );
        }

        return this.prisma.species.delete({where:{id}});
    }
}
