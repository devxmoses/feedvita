import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { ThrottlerStorage } from '@nestjs/throttler';
import { configureApp } from '../src/app.setup';

describe('Species (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let throttlerStorage: any;
  let seq = 0;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    throttlerStorage = app.get<any>(ThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    if (list) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }

    // POST /species is throttled to 5/hour and the throttler keys on IP, so
    // every request in this file shares one bucket. Without clearing it the
    // suite starts 429ing partway down - which says nothing about the code.
    throttlerStorage?._storage?.clear?.();
  });

  const seedUser = async (over: Record<string, unknown> = {}) => {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        email: `species-${seq}@test.com`,
        passwordHash: 'not-used-in-these-tests',
        name: `Person ${seq}`,
        ...over,
      },
    });

    const { access_token } = await auth.login({
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      isVendor: user.isVendor,
    });

    return { user, token: access_token };
  };

  const seedApproved = (name: string, slug: string, segment: string) =>
    prisma.species.create({ data: { name, slug, segment: segment as any, isApproved: true } });

  describe('public listing', () => {
    it('returns approved species alphabetically', async () => {
      await seedApproved('Dog', 'dog', 'PET');
      await seedApproved('Cattle', 'cattle', 'LIVESTOCK');

      const res = await http().get('/api/v1/species').expect(200);

      expect(res.body.map((s: any) => s.name)).toEqual(['Cattle', 'Dog']);
    });

    it('hides an unapproved suggestion from the public list', async () => {
      await seedApproved('Dog', 'dog', 'PET');
      await prisma.species.create({
        data: { name: 'Alpaca', slug: 'alpaca', segment: 'LIVESTOCK' },
      });

      const res = await http().get('/api/v1/species').expect(200);

      expect(res.body.map((s: any) => s.name)).toEqual(['Dog']);
    });

    it('filters by segment', async () => {
      await seedApproved('Dog', 'dog', 'PET');
      await seedApproved('Cattle', 'cattle', 'LIVESTOCK');

      const res = await http().get('/api/v1/species?segment=LIVESTOCK').expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Cattle');
    });

    it('rejects a segment outside the enum', async () => {
      await http().get('/api/v1/species?segment=FISH').expect(400);
    });

    it('serves a single species by id without a token', async () => {
      const dog = await seedApproved('Dog', 'dog', 'PET');

      const res = await http().get(`/api/v1/species/${dog.id}`).expect(200);
      expect(res.body.slug).toBe('dog');
    });

    it('404s for an unknown id', async () => {
      await http().get('/api/v1/species/no-such-id').expect(404);
    });
  });

  describe('vendor suggestions', () => {
    it('refuses an anonymous suggestion', async () => {
      await http()
        .post('/api/v1/species')
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(401);
    });

    it('refuses a suggestion from a user who is not a vendor', async () => {
      const { token } = await seedUser();

      await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(403);
    });

    it('creates an unapproved species attributed to the vendor', async () => {
      const { user, token } = await seedUser({ isVendor: true });

      const res = await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Alpaca',
        slug: 'alpaca',
        segment: 'LIVESTOCK',
        isApproved: false,
        suggestedById: user.id,
      });
    });

    it('is usable on the suggester own product straight away', async () => {
      const { token } = await seedUser({ isVendor: true });

      const species = await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(201);

      const vendor = await http()
        .post('/api/v1/vendors')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Andean Feeds ${(seq += 1)}` })
        .expect(201);

      const product = await http()
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Alpaca Pellets 20kg', price: 2500, stock: 4,
          vendorId: vendor.body.id, segments: ['LIVESTOCK'],
          speciesIds: [species.body.id],
        })
        .expect(201);

      expect(product.body.species.map((s: any) => s.slug)).toEqual(['alpaca']);
    });

    it('returns the existing species instead of 409 on a duplicate name', async () => {
      const first = await seedUser({ isVendor: true });
      const second = await seedUser({ isVendor: true });

      const a = await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${first.token}`)
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(201);

      const b = await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${second.token}`)
        .send({ name: 'alpaca', segment: 'PET' })
        .expect(201);

      expect(b.body.id).toBe(a.body.id);
      // the second submission must not re-segment or re-attribute it
      expect(b.body.segment).toBe('LIVESTOCK');
      expect(b.body.suggestedById).toBe(first.user.id);
    });

    it('validates the submission', async () => {
      const { token } = await seedUser({ isVendor: true });
      const post = (body: object) =>
        http().post('/api/v1/species').set('Authorization', `Bearer ${token}`).send(body);

      await post({ name: 'A', segment: 'LIVESTOCK' }).expect(400);
      await post({ name: 'Alpaca', segment: 'FISH' }).expect(400);
      await post({ name: 'Alpaca' }).expect(400);
      await post({ segment: 'PET' }).expect(400);
      await post({ name: '!!!', segment: 'PET' }).expect(400);
    });

    it('lists the vendor own suggestions, pending included', async () => {
      const { token } = await seedUser({ isVendor: true });
      const other = await seedUser({ isVendor: true });

      await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alpaca', segment: 'LIVESTOCK' })
        .expect(201);

      await http()
        .post('/api/v1/species')
        .set('Authorization', `Bearer ${other.token}`)
        .send({ name: 'Quail', segment: 'LIVESTOCK' })
        .expect(201);

      const mine = await http()
        .get('/api/v1/species/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].name).toBe('Alpaca');
      expect(mine.body[0].isApproved).toBe(false);
    });

    // '/mine' is a literal path segment declared before ':id'. Were the order
    // reversed, Nest would match it as an id and this would 404.
    it('routes /mine as a literal, not as an id', async () => {
      const { token } = await seedUser();

      await http()
        .get('/api/v1/species/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('requires a token for /mine', async () => {
      await http().get('/api/v1/species/mine').expect(401);
    });
  });

  describe('admin moderation', () => {
    it('keeps the pending queue closed to non-admins', async () => {
      const { token } = await seedUser({ isVendor: true });

      await http().get('/api/v1/species/pending').expect(401);
      await http()
        .get('/api/v1/species/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lists pending species for an admin', async () => {
      const admin = await seedUser({ isAdmin: true });
      await seedApproved('Dog', 'dog', 'PET');
      await prisma.species.create({
        data: { name: 'Alpaca', slug: 'alpaca', segment: 'LIVESTOCK' },
      });

      const res = await http()
        .get('/api/v1/species/pending')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Alpaca');
    });

    it('approving makes a species public', async () => {
      const admin = await seedUser({ isAdmin: true });
      const pending = await prisma.species.create({
        data: { name: 'Alpaca', slug: 'alpaca', segment: 'LIVESTOCK' },
      });

      expect((await http().get('/api/v1/species').expect(200)).body).toHaveLength(0);

      await http()
        .patch(`/api/v1/species/${pending.id}/approve`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      const res = await http().get('/api/v1/species').expect(200);
      expect(res.body.map((s: any) => s.name)).toEqual(['Alpaca']);
    });

    it('refuses approval from a vendor', async () => {
      const { token } = await seedUser({ isVendor: true });
      const pending = await prisma.species.create({
        data: { name: 'Alpaca', slug: 'alpaca', segment: 'LIVESTOCK' },
      });

      await http()
        .patch(`/api/v1/species/${pending.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('corrects a name and reslugs it', async () => {
      const admin = await seedUser({ isAdmin: true });
      const wrong = await seedApproved('Guinea fowl', 'guinea-fowl-typo', 'LIVESTOCK');

      const res = await http()
        .patch(`/api/v1/species/${wrong.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Guinea Fowl' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Guinea Fowl', slug: 'guinea-fowl' });
    });

    it('409s when a correction collides with an existing slug', async () => {
      const admin = await seedUser({ isAdmin: true });
      await seedApproved('Dog', 'dog', 'PET');
      const dupe = await seedApproved('Dogs', 'dogs', 'PET');

      await http()
        .patch(`/api/v1/species/${dupe.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Dog' })
        .expect(409);
    });
  });

  describe('merge and delete', () => {
    // one product on the duplicate only, one on both, so the merge has to be
    // idempotent for a link that already exists
    const seedDuplicates = async () => {
      const admin = await seedUser({ isAdmin: true });
      const { token } = await seedUser({ isVendor: true });

      const dog = await seedApproved('Dog', 'dog', 'PET');
      const dogs = await seedApproved('Dogs', 'dogs', 'PET');

      const vendor = await http()
        .post('/api/v1/vendors')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Canine Nutrition ${(seq += 1)}` })
        .expect(201);

      const make = async (name: string, speciesIds: string[]) => {
        const res = await http()
          .post('/api/v1/products')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name, price: 1200, stock: 3, vendorId: vendor.body.id,
            segments: ['PET'], speciesIds,
          })
          .expect(201);
        return res.body;
      };

      return {
        admin,
        dog,
        dogs,
        onlyDupe: await make('Grain Free Kibble 12kg', [dogs.id]),
        onBoth: await make('Wild Salmon Oil 500ml', [dog.id, dogs.id]),
      };
    };

    it('moves product links to the target and deletes the duplicate', async () => {
      const { admin, dog, dogs } = await seedDuplicates();

      const res = await http()
        .post(`/api/v1/species/${dogs.id}/merge`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ targetId: dog.id })
        .expect(201);

      expect(res.body.merged).toBe(2);
      expect(res.body.target.id).toBe(dog.id);

      await http().get(`/api/v1/species/${dogs.id}`).expect(404);

      const kept = await http().get(`/api/v1/products?speciesId=${dog.id}`).expect(200);
      expect(kept.body.meta.total).toBe(2);
    });

    it('leaves a product that already had both species with exactly one link', async () => {
      const { admin, dog, dogs, onBoth } = await seedDuplicates();

      await http()
        .post(`/api/v1/species/${dogs.id}/merge`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ targetId: dog.id })
        .expect(201);

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: onBoth.id },
        include: { species: true },
      });

      expect(product.species).toHaveLength(1);
      expect(product.species[0].id).toBe(dog.id);
    });

    it('refuses to merge a species into itself', async () => {
      const { admin, dog } = await seedDuplicates();

      await http()
        .post(`/api/v1/species/${dog.id}/merge`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ targetId: dog.id })
        .expect(400);
    });

    it('404s when the merge target does not exist', async () => {
      const { admin, dogs } = await seedDuplicates();

      await http()
        .post(`/api/v1/species/${dogs.id}/merge`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ targetId: 'no-such-species' })
        .expect(404);
    });

    it('refuses a merge from a vendor', async () => {
      const { dog, dogs } = await seedDuplicates();
      const vendor = await seedUser({ isVendor: true });

      await http()
        .post(`/api/v1/species/${dogs.id}/merge`)
        .set('Authorization', `Bearer ${vendor.token}`)
        .send({ targetId: dog.id })
        .expect(403);
    });

    it('deletes a species nothing references', async () => {
      const admin = await seedUser({ isAdmin: true });
      const unused = await seedApproved('Quail', 'quail', 'LIVESTOCK');

      await http()
        .delete(`/api/v1/species/${unused.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      await http().get(`/api/v1/species/${unused.id}`).expect(404);
    });

    it('refuses to delete one still in use, pointing at merge instead', async () => {
      const { admin, dogs } = await seedDuplicates();

      const res = await http()
        .delete(`/api/v1/species/${dogs.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(409);

      expect(res.body.message).toMatch(/merge/i);
    });

    it('refuses a delete from a vendor', async () => {
      const vendor = await seedUser({ isVendor: true });
      const unused = await seedApproved('Quail', 'quail', 'LIVESTOCK');

      await http()
        .delete(`/api/v1/species/${unused.id}`)
        .set('Authorization', `Bearer ${vendor.token}`)
        .expect(403);
    });
  });
});
