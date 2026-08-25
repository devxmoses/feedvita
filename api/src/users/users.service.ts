import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const passwordHash= await bcrypt.hash(createUserDto.password,10);
    const user = await this.prisma.user.create({
      data:{
        email:createUserDto.email,
        passwordHash,
        name:createUserDto.name,
      }
    });
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map(({passwordHash:_omit, ...safeUser})=>safeUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // Ensure the user exists before updating
    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  }

  async remove(id: string) {
    const user = await this.prisma.user.delete({
      where: { id },
    });
    const { passwordHash: _omit, ...safeUser } = user;
    return safeUser;
  }

  async findByEmailWithPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user; 
  }
}