import { Controller, Get, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { SelfOrAdminGuard } from '../auth/guards/self-or-admin.guard';


@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiResponse({ status: 403, description: 'Admins only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your own account or any, as admin' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'The user' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'You can only access your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(JwtAuthGuard, SelfOrAdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your own account (or any, as admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 403, description: 'You can only access your own account' })
  @UseGuards(JwtAuthGuard, SelfOrAdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }


  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your own account (or any, as admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'You can only access your own account' })
  @UseGuards(JwtAuthGuard, SelfOrAdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
