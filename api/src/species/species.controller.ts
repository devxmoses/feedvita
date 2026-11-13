import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SpeciesService } from './species.service';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { UpdateSpeciesDto } from './dto/update-species.dto';
import { FindSpeciesQueryDto } from './dto/find-species-query.dto';
import { MergeSpeciesDto } from './dto/merge-species.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@ApiTags('species')
@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @ApiOperation({ summary: 'List approved species, optionally filtered by segment' })
  @ApiResponse({ status: 200, description: 'Approved species, A-Z' })
  @Get()
  findAll(@Query() query: FindSpeciesQueryDto) {
    return this.speciesService.findAllApproved(query);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Species you have suggested, including ones awaiting approval' })
  @ApiResponse({ status: 200, description: 'Your suggestions, newest first' })
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Request() req) {
    return this.speciesService.findMine(req.user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Species awaiting approval (admin only)' })
  @ApiResponse({ status: 403, description: 'Admins only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('pending')
  findPending() {
    return this.speciesService.findPending();
  }

  @ApiOperation({ summary: 'Get a single species by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 404, description: 'Species not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.speciesService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Suggest a species not yet listed (vendors)',
    description:
      'Created unapproved, so it is usable on your own products immediately but ' +
      'hidden from the public filter list until an admin approves it. Submitting a ' +
      'name that already exists returns the existing species rather than failing.',
  })
  @ApiResponse({ status: 201, description: 'The new or existing species' })
  @ApiResponse({ status: 403, description: 'Vendors only' })
  // a write to shared catalogue vocabulary: nobody legitimately finds
  // ten unlisted species in an hour
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Vendor)
  @Post()
  suggest(@Request() req, @Body() createSpeciesDto: CreateSpeciesDto) {
    return this.speciesService.suggest(req.user.id, createSpeciesDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a suggested species (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 403, description: 'Admins only' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.speciesService.approve(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Correct a species name or segment (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 409, description: 'Another species already has that name or slug' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSpeciesDto: UpdateSpeciesDto) {
    return this.speciesService.update(id, updateSpeciesDto);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Merge a duplicate into another species (admin only)',
    description: 'Moves every product link to the target, then deletes this species.',
  })
  @ApiParam({ name: 'id', description: 'The duplicate, which is deleted' })
  @ApiResponse({ status: 200, description: 'How many products moved, and the surviving species' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() mergeSpeciesDto: MergeSpeciesDto) {
    return this.speciesService.merge(id, mergeSpeciesDto.targetId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unused species (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 409, description: 'Still used by products - merge it instead' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.speciesService.remove(id);
  }
}
 