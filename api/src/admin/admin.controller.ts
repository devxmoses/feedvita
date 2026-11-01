import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator'
import { Role } from '../auth/enums/role.enum'

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('admin')

export class AdminController {
 constructor (private readonly adminService: AdminService) {}

 @ApiOperation({ summary: 'Platform-wide statistics (admin only)' })
 @ApiResponse({ status:200, description:'Totals, order status breakdown, revenue and top vendors '})
 @ApiResponse({ status:403, description:'Admins only'})
 @Get('stats')
 getStats(){
    return this.adminService.getStats();
 }

}
