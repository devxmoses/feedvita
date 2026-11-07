import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Marketplace flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let seq = 0;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // mirror main.ts so validation behaves exactly as it does in production
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
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
  });

  // Users are seeded directly and tokens minted through the app's own AuthService.
  // Going through POST /auth/register for every test would trip its 5/min throttle
  // partway down the file; one test below still exercises that route for real.
  const seedUser = async (over: Record<string, unknown> = {}) => {
    seq += 1;
    const user = await prisma.user.create({
      data: {
        email: `person-${seq}@test.com`,
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

  const listProduct = async (token: string, stock = 10, price = 4999) => {
    const vendor = await http()
      .post('/vendors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Green Valley Nutrition ${seq}` })
      .expect(201);

    const product = await http()
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cold Pressed Ginger Shot 250ml', price, stock, vendorId: vendor.body.id })
      .expect(201);

    return { vendorId: vendor.body.id as string, productId: product.body.id as string };
  };

  const addToCart = (token: string, productId: string, quantity: number) =>
    http()
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity })
      .expect(201);

  it('registers a user over HTTP and returns a usable token pair', async () => {
    const res = await http()
      .post('/auth/register')
      .send({ email: 'registered@test.com', password: 'password123', name: 'Registered' })
      .expect(201);

    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();

    // the issued token actually authenticates against a protected route
    await http().get('/cart').set('Authorization', `Bearer ${res.body.access_token}`).expect(200);
  });

  it('runs vendor -> product -> cart -> checkout end to end', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token, 10, 4999);

    await addToCart(token, productId, 2);

    const cart = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(2);

    const order = await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(201);

    expect(order.body.total).toBe(9998);
    expect(order.body.status).toBe('PENDING');
    expect(order.body.items).toHaveLength(1);
    expect(order.body.items[0].unitPrice).toBe(4999);
    expect(order.body.items[0].productName).toBe('Cold Pressed Ginger Shot 250ml');

    // stock decremented and cart emptied inside the same transaction
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product!.stock).toBe(8);

    const emptied = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(emptied.body.items).toHaveLength(0);
  });

  it('changes a cart line quantity before checkout', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 2);

    await http()
      .patch(`/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 })
      .expect(200);

    const cart = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items[0].quantity).toBe(5);
  });

  it('removes a cart line', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 1);

    await http()
      .delete(`/cart/items/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const cart = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items).toHaveLength(0);
  });

  it('empties the whole cart', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 2);

    await http().delete('/cart').set('Authorization', `Bearer ${token}`).expect(200);

    const cart = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items).toHaveLength(0);
  });

  it('adding the same product twice increments rather than duplicating', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 2);
    await addToCart(token, productId, 3);

    const cart = await http().get('/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(5);
  });

  it('refuses checkout on an empty cart', async () => {
    const { token } = await seedUser();

    await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('refuses checkout when stock is short, leaving stock untouched', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token, 1);

    await addToCart(token, productId, 5);

    await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(409);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product!.stock).toBe(1);
  });

  it('cancels a pending order and restocks it', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token, 10);

    await addToCart(token, productId, 3);
    const order = await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(201);

    const afterCheckout = await prisma.product.findUnique({ where: { id: productId } });
    expect(afterCheckout!.stock).toBe(7);

    const cancelled = await http()
      .patch(`/orders/${order.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const afterCancel = await prisma.product.findUnique({ where: { id: productId } });
    expect(afterCancel!.stock).toBe(10);
  });

  it('refuses to cancel an order that is no longer pending', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 1);
    const order = await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(201);

    await prisma.order.update({ where: { id: order.body.id }, data: { status: 'SHIPPED' } });

    await http()
      .patch(`/orders/${order.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it("does not let another user read or cancel somebody else's order", async () => {
    const owner = await seedUser();
    const { productId } = await listProduct(owner.token);
    await addToCart(owner.token, productId, 1);
    const order = await http()
      .post('/orders')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(201);

    const stranger = await seedUser();

    await http()
      .get(`/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);

    await http()
      .patch(`/orders/${order.body.id}/cancel`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });

  it('does not let a non-owner list products under your vendor', async () => {
    const owner = await seedUser();
    const { vendorId } = await listProduct(owner.token);

    const stranger = await seedUser();

    await http()
      .post('/products')
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ name: 'Counterfeit Tonic', price: 100, stock: 1, vendorId })
      .expect(403);
  });

  it('lets a vendor owner see order items for their own vendor only', async () => {
    const owner = await seedUser();
    const { vendorId, productId } = await listProduct(owner.token);
    await addToCart(owner.token, productId, 2);
    await http().post('/orders').set('Authorization', `Bearer ${owner.token}`).expect(201);

    const mine = await http()
      .get(`/orders/vendor/${vendorId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].vendorId).toBe(vendorId);

    const stranger = await seedUser();
    await http()
      .get(`/orders/vendor/${vendorId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });

  it('rejects a review for a product the buyer has not received', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await http()
      .post('/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, rating: 5, comment: 'Great' })
      .expect(403);
  });

  it('accepts one review per buyer once the order is delivered', async () => {
    const { token } = await seedUser();
    const { productId } = await listProduct(token);

    await addToCart(token, productId, 1);
    const order = await http().post('/orders').set('Authorization', `Bearer ${token}`).expect(201);

    await prisma.order.update({ where: { id: order.body.id }, data: { status: 'DELIVERED' } });

    const review = await http()
      .post('/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, rating: 5, comment: 'Arrived cold and tasted fresh.' })
      .expect(201);
    expect(review.body.rating).toBe(5);

    // the one-review-per-product rule is enforced by the database unique constraint
    await http()
      .post('/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, rating: 4 })
      .expect(409);
  });

  it('keeps admin-only routes closed to ordinary users', async () => {
    const { token } = await seedUser();

    await http().get('/admin/stats').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('serves admin stats to an admin', async () => {
    const { token } = await seedUser({ isAdmin: true });

    const res = await http().get('/admin/stats').set('Authorization', `Bearer ${token}`).expect(200);

    expect(typeof res.body.totals.users).toBe('number');
    expect(res.body.revenue).toHaveProperty('collected');
  });

  it('requires authentication on protected routes', async () => {
    await http().get('/cart').expect(401);
    await http().post('/orders').expect(401);
    await http().get('/admin/stats').expect(401);
  });

  it('rejects an invalid payload before it reaches the service', async () => {
    const { token } = await seedUser();

    await http()
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'p1', quantity: 0 })
      .expect(400);
  });

    it('does not hand out a user record to an anonymous caller', async () => {
    const { user } = await seedUser();

    await http().get(`/users/${user.id}`).expect(401);
  });

  it("does not let one user read another user's account", async () => {
    const victim = await seedUser();
    const stranger = await seedUser();

    await http()
      .get(`/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });

  it('lets a user read their own account, without the password hash', async () => {
    const me = await seedUser();

    const res = await http()
      .get(`/users/${me.user.id}`)
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200);

    expect(res.body.email).toBe(me.user.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('lets an admin read anybody', async () => {
    const victim = await seedUser();
    const admin = await seedUser({ isAdmin: true });

    const res = await http()
      .get(`/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.id).toBe(victim.user.id);
  });

  it('serves a health check without a token', async () => {
    const res = await http().get('/health').expect(200);

    expect(res.body.status).toBe('ok');
  });

});
