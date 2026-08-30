import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma:PrismaService){}

  async create(createCategoryDto: CreateCategoryDto) {
    const slug = slugify(createCategoryDto.slug ?? createCategoryDto.name);

    if(createCategoryDto.parentId){
      const parent = await this.prisma.category.findUnique({ where:{id: createCategoryDto.parentId}})
      if(!parent) throw new NotFoundException(`Parent category with ID ${createCategoryDto.parentId} not found`)
    }


    return this.prisma.category.create({
      data:{...createCategoryDto,slug}
    })

  }

  findAll() {
    return this.prisma.category.findMany({
      include:{children:true},
      orderBy:{name:'asc'},
    });
  }

  async findOne(id: string) {
   const category = await this.prisma.category.findUnique({
    where:{id},
    include:{children:true},
   });
   if(!category) throw new NotFoundException(`Category with ID ${id} not found`)
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);

    if(updateCategoryDto.parentId){
      if(updateCategoryDto.parentId === id){
        throw new BadRequestException('A category cannot be its own parent')
      }
      const parent = await this.prisma.category.findUnique({ where:{id: updateCategoryDto.parentId}})
      if(!parent) throw new NotFoundException(`Parent category with ID ${updateCategoryDto.parentId} not found`)
    };

    const {slug, ...rest} = updateCategoryDto;
    return this.prisma.category.update({
      where:{id},
      data:{
          ...rest,
          ...(slug?{slug:slugify(slug)}:{})
      }
    })
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.category.delete({where:{id}});
  }
}
