import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { paginate } from '../common/dto/paginated';
import { expandSegments } from './segment-hierarchy';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma:PrismaService){}

    // Prisma's connect/set throws P2025 for a missing id, which the global filter
  // maps to a 404 that says nothing useful. Checking first names the bad ids.
  private async assertSpeciesExist(speciesIds:string[]){
    if(!speciesIds.length) return;

    const found = await this.prisma.species.findMany({
      where:{id:{in:speciesIds}},
      select:{id:true},
    });

    const foundIds = new Set(found.map((s)=>s.id));
    const missing = speciesIds.filter((id)=>!foundIds.has(id));

    if(missing.length){
      throw new NotFoundException(`Species not found: ${missing.join(', ')}`);
    }
  }

  async create(createProductDto:CreateProductDto){
    const slug = slugify(createProductDto.slug??createProductDto.name);
    
    if(createProductDto.categoryId){
      const category = await this.prisma.category.findUnique({
        where:{id:createProductDto.categoryId},
      });
      if(!category){
        throw new NotFoundException(
          `Category with ID ${createProductDto.categoryId} not found`
        )
      }
    }

    const {speciesIds, ...rest} = createProductDto;

    if(speciesIds?.length){
      await this.assertSpeciesExist(speciesIds);
    }

    return this.prisma.product.create({
      data:{
        ...rest,
        slug,
        stock: createProductDto.stock ?? 0,
        isActive:createProductDto.isActive??true,
        ...(speciesIds?.length
          ? {species:{connect:speciesIds.map((id)=>({id}))}}
          : {}),
      },
       include:{species:true},
    });
  }


  async findAll(query:FindProductsQueryDto){
    const {page, limit, sortBy, order, vendorId, categoryId, segments, speciesId} = query;
    const where = {
      ...(vendorId?{vendorId}:{}),
      ...(categoryId ? {categoryId} : {}),
      ...(segments?.length ? {segments:{hasSome:expandSegments(segments)}} : {}),
      ...(speciesId ? {species:{some:{id:speciesId}}} : {}),
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy:{[sortBy]:order},
        skip:(page-1)*limit,
        take:limit,
      }),
      this.prisma.product.count({where}),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id:string){
    const product = await this.prisma.product.findUnique({where:{id}})
    if(!product) throw new NotFoundException(`Product with ID ${id} not found`);
    return product;
  }

  async update(id:string,updateProductDto:UpdateProductDto){
    await this.findOne(id);

    if(updateProductDto.categoryId){
      const category = await this.prisma.category.findUnique({
        where:{id:updateProductDto.categoryId},
      });
      if(!category){
        throw new NotFoundException(
          `Category with ID ${updateProductDto.categoryId} not found`
        )
      }
    }

    const {slug,speciesIds, ...rest} = updateProductDto;
     if(speciesIds){
      await this.assertSpeciesExist(speciesIds);
    }

    return this.prisma.product.update({
      where:{id},
      data:{
        ...rest,
        ...(slug?{slug:slugify(slug)}:{}),
        ...(speciesIds?{species:{set:speciesIds.map((sid)=>({id:sid}))}}:{}),
      },
      include:{species:true},
    })
  }

  async remove(id: string){
    await this.findOne(id);
    return this.prisma.product.delete({where:{id}});
  }
}
