import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma:PrismaService
  ){}
  async create(ownerId:string,createVendorDto: CreateVendorDto) {

    const slug = slugify(createVendorDto.slug ?? createVendorDto.name);
    return await this.prisma.$transaction(async (tx)=>{
      const vendor = await tx.vendor.create({
        data:{
          name:createVendorDto.name,
          description:createVendorDto.description,
          slug,
          ownerId,
        },
      });
      await tx.user.update({
        where:{id:ownerId},
        data:{isVendor:true},
      })
      return vendor;
    })
    
  }

  findAll() {
    return this.prisma.vendor.findMany();
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({where:{id}});
    if(!vendor) throw new NotFoundException(`Vendor with ID ${id} not found`)
    return vendor;

  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    await this.findOne(id);
    const {slug, ...rest} = updateVendorDto;
    return await this.prisma.vendor.update({
      where:{id},
      data:{
        ...rest,
        ...(slug ? {slug: slugify(slug)}:{}), //slug
      }
    })
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vendor.delete({where:{id}});
  }
}
