import { Test, TestingModule } from '@nestjs/testing';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';
import { Segment } from '../../generated/prisma/enums';

const asRequest = (userId: string) => ({ user: { id: userId } }) as any;

describe('SpeciesController', () => {
  let controller: SpeciesController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAllApproved: jest.fn(),
      findMine: jest.fn(),
      findPending: jest.fn(),
      findOne: jest.fn(),
      suggest: jest.fn(),
      approve: jest.fn(),
      update: jest.fn(),
      merge: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpeciesController],
      providers: [{ provide: SpeciesService, useValue: service }],
    }).compile();

    controller = module.get(SpeciesController);
  });

  it('passes the query through to the approved listing', async () => {
    await controller.findAll({ segment: Segment.PET });

    expect(service.findAllApproved).toHaveBeenCalledWith({ segment: Segment.PET });
  });

  // the caller must never be able to name somebody else as the suggester,
  // so the id comes off the token rather than out of the body
  it('takes the suggester from the token, not the body', async () => {
    await controller.suggest(asRequest('u1'), {
      name: 'Alpaca',
      segment: Segment.LIVESTOCK,
    } as any);

    expect(service.suggest).toHaveBeenCalledWith('u1', {
      name: 'Alpaca',
      segment: Segment.LIVESTOCK,
    });
  });

  it('scopes "mine" to the authenticated user', async () => {
    await controller.findMine(asRequest('u2'));

    expect(service.findMine).toHaveBeenCalledWith('u2');
  });

  it('merges the path id into the body target', async () => {
    await controller.merge('dup', { targetId: 'keep' });

    expect(service.merge).toHaveBeenCalledWith('dup', 'keep');
  });

  it('forwards approve, update and remove by id', async () => {
    await controller.approve('s1');
    await controller.update('s1', { segment: Segment.PET });
    await controller.remove('s1');

    expect(service.approve).toHaveBeenCalledWith('s1');
    expect(service.update).toHaveBeenCalledWith('s1', { segment: Segment.PET });
    expect(service.remove).toHaveBeenCalledWith('s1');
  });
});
