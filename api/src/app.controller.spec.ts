import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    controller = module.get(AppController);
  });

  it('reports ok with an uptime and a timestamp', () => {
    const res = controller.health();

    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
    expect(Number.isNaN(Date.parse(res.timestamp))).toBe(false);
  });

  // a health endpoint that touches the database turns a slow query into a
  // false "the service is down", so this one deliberately has no dependencies
  it('needs no injected dependencies', () => {
    expect(AppController.length).toBe(0);
  });
});
