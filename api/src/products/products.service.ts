import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma:PrismaService){}

  async create(createProductDto:CreateProductDto){
    const slug = slugify(createProductDto.slug??createProductDto.name);
    return await this.prisma.product.create({
      data:{
        ...createProductDto,
        slug,
        stock: createProductDto.stock ?? 0,
        isActive:createProductDto.isActive??true,
      },
    });
  }


  findAll(vendorId?:string){
    return this.prisma.product.findMany({
      where:vendorId?{vendorId}:undefined,
    });
  }

  async findOne(id:string){
    const product = await this.prisma.product.findUnique({where:{id}})
    if(!product) throw new NotFoundException(`Product with ID ${id} not found`);
    return product;
  }

  async update(id:string,updateProductDto:UpdateProductDto){
    await this.findOne(id);
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
