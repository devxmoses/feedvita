import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { paginate } from '../common/dto/paginated';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma:PrismaService){}

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
    return this.prisma.product.create({
      data:{
        ...createProductDto,
        slug,
        stock: createProductDto.stock ?? 0,
        isActive:createProductDto.isActive??true,
      },
    });
  }


  async findAll(query:FindProductsQueryDto){
    const {page, limit, sortBy, order, vendorId, categoryId} = query;
    const where = {
      ...(vendorId?{vendorId}:{}),
      ...(categoryId ? {categoryId} : {})
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

    const {slug, ...rest} = updateProductDto;
    return this.prisma.product.update({
      where:{id},
      data:{
        ...rest,
        ...(slug?{slug:slugify(slug)}:{}),
      }
    })
  }

  async remove(id: string){
    await this.findOne(id);
    return this.prisma.product.delete({where:{id}});
  }
}
