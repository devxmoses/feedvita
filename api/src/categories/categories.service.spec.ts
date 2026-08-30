import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';


describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma:{
    category:{
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    }
  };

  beforeEach(async () => {
    prisma = {
      category:{
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(()=>{
    jest.clearAllMocks();
  });

  describe('create',()=>{
    it('derives the slug from name when no slug is given', async()=>{
      prisma.category.create.mockResolvedValue({id:'1', name:'Fresh Fruit'});

      await service.create({ name:'Fresh Fruit'} as any );

      expect(prisma.category.create).toHaveBeenCalledWith({
        data:{name:'Fresh Fruit', slug:'fresh-fruit'},
      });
    });


    it('slugifies an explicitly provided slug rather than using it raw', async()=>{
      prisma.category.create.mockResolvedValue({id:'1'});

      await service.create ({
        name: 'Fresh Fruit',
        slug: 'Custom Slug!!',
      } as any);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {name: 'Fresh Fruit', slug:'custom-slug'},
      });
    });

    it('creates without a parent lookup when parentId is not given', async () => {
      prisma.category.create.mockResolvedValue({id:'1'});

      await service.create({name:'Fresh Fruit'} as any);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when parentId does not resolve to a category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({name:'Fresh Fruit', parentId:'missing'} as any),
      ).rejects.toThrow(NotFoundException);
      expect (prisma.category.create).not.toHaveBeenCalled();
    });

    it('creates when parentId resolves to an existing category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'parent-1' });
      prisma.category.create.mockResolvedValue({ id: '1' });
         await service.create({
        name: 'Fresh Fruit',
        parentId: 'parent-1',
      } as any);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'parent-1' },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Fresh Fruit', parentId: 'parent-1', slug: 'fresh-fruit' },
      });
    });

  });


  describe('findAll', () => {
    it('lists categories with children included, ordered by name', async () => {
      const categories = [{ id: '1', name: 'Fruit' }];
      prisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        include: { children: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toBe(categories);
    });
  });

  describe('findOne', () => {
    it('returns the category when found', async () => {
      const category = { id: '1', name: 'Fruit' };
      prisma.category.findUnique.mockResolvedValue(category);

      const result = await service.findOne('1');

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { children: true },
      });
      expect(result).toBe(category);
    });

    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates a category that is not changing its parent (regression: must not no-op)', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: '1', name: 'Old' });
      prisma.category.update.mockResolvedValue({ id: '1', name: 'New' });

      const result = await service.update('1', { name: 'New' } as any);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'New' },
      });
      expect(result).toEqual({ id: '1', name: 'New' });
    });

    it('throws NotFoundException when the category being updated does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'New' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when parentId is set to its own id', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: '1', name: 'Old' });

      await expect(
        service.update('1', { parentId: '1' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the new parentId does not resolve', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Old' }) // findOne(id)
        .mockResolvedValueOnce(null); // parent lookup

      await expect(
        service.update('1', { parentId: 'missing-parent' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('updates the parent when the new parentId resolves to an existing category', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce({ id: '1', name: 'Old' }) // findOne(id)
        .mockResolvedValueOnce({ id: 'parent-1' }); // parent lookup
      prisma.category.update.mockResolvedValue({ id: '1', parentId: 'parent-1' });

      await service.update('1', { parentId: 'parent-1' } as any);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { parentId: 'parent-1' },
      });
    });

    it('re-slugifies when slug is provided', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: '1', name: 'Old' });
      prisma.category.update.mockResolvedValue({ id: '1' });

      await service.update('1', { slug: 'New Slug!!' } as any);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { slug: 'new-slug' },
      });
    });

    it('omits slug from the update payload when not provided', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: '1', name: 'Old' });
      prisma.category.update.mockResolvedValue({ id: '1' });

      await service.update('1', { name: 'Renamed' } as any);

      const [[callArgs]] = prisma.category.update.mock.calls;
      expect(callArgs.data).not.toHaveProperty('slug');
    });
  });

  describe('remove', () => {
    it('deletes the category after confirming it exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: '1', name: 'Fruit' });
      prisma.category.delete.mockResolvedValue({ id: '1' });

      const result = await service.remove('1');

      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual({ id: '1' });
    });

    it('throws NotFoundException instead of deleting when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });
  });

  
});
