<div align="center">

# Nuvita

### A multi-vendor marketplace for food, beverages, wellness products and equipment — for people, pets and livestock

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/tests-201%20unit%20%2B%2031%20e2e-success?style=flat-square)

`JWT rotation` · `RBAC` · `Persisted cart` · `Atomic checkout` · `Stripe webhooks` · `Swagger`

**Work in progress.** Everything below is marked ✅ built or 🚧 planned.

</div>

---

## About

Nuvita is a multi-vendor commerce platform for nutrition and wellness — food,
beverages, supplements and the equipment that goes with them — serving both human
and animal customers across pets and livestock.

Vendors run their own storefronts, catalogue and inventory. Customers build a
server-side cart across vendors and check out once; the API turns that cart into an
order with immutable line-item snapshots while decrementing stock atomically.
Payment runs through Stripe PaymentIntents behind a signature-verified webhook.

The product taxonomy is a self-referential category tree, so the human/pet/livestock
split and everything beneath it — `Livestock › Poultry › Layer Feed`,
`Humans › Beverages › Cold Pressed`, `Pets › Equipment › Feeders` — is data rather
than schema.

The API is the part that exists today. The web client, background jobs and
per-vendor fulfilment are next.

---

## Status at a glance

| Area | State |
|---|---|
| REST API — 11 NestJS modules | ✅ built |
| JWT auth, refresh rotation, reuse detection | ✅ built |
| RBAC + per-resource ownership guards | ✅ built |
| Persisted cart → atomic checkout → cancellation with restock | ✅ built |
| Stripe PaymentIntents + idempotent webhook | ✅ built |
| Category tree, reviews gated on delivered purchase | ✅ built |
| Admin analytics | ✅ built |
| Rate limiting, global exception mapping, OpenAPI docs | ✅ built |
| Test suite — 201 unit, 31 end-to-end | ✅ built |
| `/api/v1` global prefix | 🚧 planned |
| Per-vendor order splitting (`VendorOrder`) | 🚧 planned |
| `ProductVariant`, `Address`, `DeliveryZone`, `Notification` | 🚧 planned |
| Vendor approval flow | 🚧 planned |
| Redis + BullMQ background jobs | 🚧 planned |
| S3 / Cloudinary uploads | 🚧 planned |
| WebSocket order updates | 🚧 planned |
| Stripe Connect vendor payouts | 🚧 planned |
| Next.js 15 web client | 🚧 planned |

---

## Roles

| Role | Can |
|---|---|
| **Customer** | ✅ browse vendors, products, categories · manage a cart · check out · cancel while `PENDING` · review delivered purchases · 🚧 saved addresses, order tracking |
| **Vendor** | ✅ create storefronts · manage own products and stock · read order items for own vendors · 🚧 fulfil per-vendor orders, set delivery zones, Stripe Connect payouts |
| **Admin** | ✅ manage categories · move any order's status · platform analytics · 🚧 approve vendors, handle disputes |

Roles are boolean flags on `User` (`isVendor`, `isAdmin`) carried in the access token,
so guards authorize without a database round trip.

Vendor status is currently self-service — creating a vendor flips `isVendor` on the
owner inside the same transaction. The approval queue (🚧) will move that flip to the
moment an admin approves.

---

## Target architecture

```
┌──────────────────────────────────────────────────────────────┐
│        🚧 Next.js 15 — App Router (SSR + RSC)                │
│    (customer) │ (vendor) │ (admin) │ route handlers          │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTPS / REST  ·  🚧 WebSocket
┌─────────────────────────▼────────────────────────────────────┐
│          ✅ NestJS 11 — Modular REST API                      │
│   Auth │ Guards │ Pipes │ Exception Filters │ Throttler       │
└──────┬───────────────┬───────────────────┬────────────────────┘
       │               │                   │
 ┌─────▼──────┐  ┌─────▼──────┐   ┌───────▼───────┐
 │ ✅ Prisma 7 │  │ 🚧 Redis    │   │ ✅ Stripe API  │
 │  + pg      │  │  + BullMQ   │   │  🚧 Connect    │
 └─────┬──────┘  └────────────┘   └───────────────┘
       │
 ┌─────▼──────────┐   ┌──────────────┐
 │ ✅ PostgreSQL 16│   │ 🚧 S3 /       │
 │                │   │   Cloudinary  │
 └────────────────┘   └──────────────┘
```

### Patterns

- ✅ **Domain-driven modules** — one NestJS module per business domain
- ✅ **Global `PrismaService`** with the Prisma 7 `pg` driver adapter
- ✅ **JWT refresh rotation** — 15m access tokens, SHA-256-hashed 7d refresh tokens
- ✅ **Atomic checkout** — stock decrement, order creation and cart clearing in one `$transaction`
- ✅ **Centralised Prisma error mapping** — `P2002` → 409, `P2025` → 404, `P2003` → 400
- 🚧 **Monorepo** via npm workspaces (`apps/api`, `apps/web`, `packages/*`)
- 🚧 **Order splitting** — cart grouped by vendor into `VendorOrder` rows in one transaction
- 🚧 **BullMQ queues** for email, order processing and payouts

---

## Domain model

### Today ✅

```
User  (isVendor / isAdmin flags)
 ├── RefreshToken (1:N)   hashed, rotated on use
 ├── Vendor (1:N)         a user may run several storefronts
 │    └── Product (1:N)
 ├── Cart (1:1)           persisted server-side
 │    └── CartItem (1:N)  unique per (cart, product)
 ├── Order (1:N)
 │    └── OrderItem (1:N) snapshots productName + unitPrice at purchase
 └── Review (1:N)         unique per (product, author)

Category   self-referential tree (parent / children)
 └── Product (1:N)

Payment → Order (1:N)     one row per Stripe PaymentIntent

OrderStatus    PENDING · PAID · SHIPPED · DELIVERED · CANCELLED
PaymentStatus  PENDING · SUCCEEDED · FAILED
```

### Planned 🚧

```
Order
 └── VendorOrder (1:N)    one per vendor in the cart; status moves per vendor
      └── OrderItem (1:N) re-parented from Order

Product
 └── ProductVariant (1:N) price + stock move down to the variant

Vendor
 ├── DeliveryZone (1:N)
 └── status              PENDING_APPROVAL · APPROVED · SUSPENDED

User
 ├── Address (1:N)       Order gains a shippingAddressId
 └── Notification (1:N)  delivered over WebSocket
```

Both planned changes are migrations with real reach — see **Roadmap** for the order
they're sequenced in and why.

---

## Design notes

The decisions in the code worth knowing about. All of these are built.

**Money is stored in minor units.** `Product.price` and `Order.total` are `Int` — cents,
kobo, pence. No floating point anywhere near a price.

**Checkout is one transaction.** `POST /orders` loads the cart, decrements each product's
stock with a conditional `updateMany` (`WHERE stock >= quantity`), writes the order with
price snapshots, and clears the cart — all inside a single `$transaction`. A `count` of 0
from the decrement means someone else took the stock first, and the whole thing rolls
back with `409`.

**Line items are immutable.** `OrderItem` stores `productName` and `unitPrice` as they were
at purchase, so a vendor renaming or repricing never rewrites history.
`OrderItem.product` uses `onDelete: Restrict`; `CartItem.product` uses `Cascade`, because
a cart is ephemeral and an order is a record.

**Cancellation restocks.** `PATCH /orders/:id/cancel` re-reads the status inside the
transaction, refuses anything but `PENDING`, and increments stock back. `PATCH /orders/:id`
explicitly rejects `CANCELLED` so the restock path cannot be bypassed.

**Refresh tokens rotate, and reuse is detected.** Tokens are stored as SHA-256 hashes and
consumed with a conditional delete. A token that verifies but has no row was already
redeemed — treated as theft, and every session for that user is dropped. A token that
merely aged out retires only itself.

**Login timing is constant.** An unknown email is compared against a dummy bcrypt hash at
the same cost factor, so response time cannot be used to enumerate registered addresses.

**Stripe calls are idempotent.** `createIntent` passes an idempotency key derived from the
order, so a reloaded checkout page gets the same intent back rather than a second payable
one. The webhook acknowledges intents it holds no row for — rather than erroring and
triggering three days of retries — and refuses to mark a cancelled order paid.

---

## API reference

No global prefix yet (`/api/v1` is 🚧). Interactive docs at `/api/docs`.

### Auth
| Method | Endpoint | Access | Notes |
|---|---|---|---|
| `POST` | `/auth/register` | public | returns a token pair · 5/min |
| `POST` | `/auth/login` | public | returns a token pair · 5/min |
| `POST` | `/auth/refresh` | public | rotates the pair · 5/min |
| `POST` | `/auth/logout` | public | invalidates one refresh token · 5/min |

### Users
| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/users` | admin |
| `GET` · `PATCH` · `DELETE` | `/users/:id` | self or admin |

### Vendors
| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/vendors` | authenticated |
| `GET` | `/vendors`, `/vendors/:id` | public |
| `PATCH` · `DELETE` | `/vendors/:id` | vendor owner or admin |

### Products
| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/products` | owner of the target vendor |
| `GET` | `/products?vendorId=&categoryId=` | public |
| `GET` | `/products/:id` | public |
| `PATCH` · `DELETE` | `/products/:id` | product's vendor owner or admin |

### Categories
| Method | Endpoint | Access |
|---|---|---|
| `POST` · `PATCH` · `DELETE` | `/categories[/:id]` | admin |
| `GET` | `/categories`, `/categories/:id` | public |

### Cart — all authenticated, always scoped to the caller
| Method | Endpoint |
|---|---|
| `GET` | `/cart` |
| `POST` | `/cart/items` |
| `PATCH` · `DELETE` | `/cart/items/:productId` |
| `DELETE` | `/cart` |

### Orders — all authenticated
| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/orders` | checks out the caller's cart |
| `GET` | `/orders` | the caller's own orders |
| `GET` | `/orders/vendor/:vendorId` | that vendor's owner |
| `GET` | `/orders/:id` | buyer or admin |
| `PATCH` | `/orders/:id` | admin — set status |
| `PATCH` | `/orders/:id/cancel` | buyer or admin, `PENDING` only |

### Reviews
| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/reviews` | authenticated, delivered purchase required |
| `GET` | `/reviews?productId=`, `/reviews/:id` | public |
| `PATCH` · `DELETE` | `/reviews/:id` | author or admin |

### Payments · Admin · Health
| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/payments/create-intent` | authenticated, own `PENDING` order |
| `POST` | `/payments/webhook` | Stripe signature |
| `GET` | `/admin/stats` | admin |
| `GET` | `/health` | public |

A global rate limit of 100 requests/minute applies, auth routes are tightened to
5/minute, and the Stripe webhook is exempt.

---

## Repository structure

### Today

```
nuvita/
├── api/                           # NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/
│   │   │   ├── filters/           # global Prisma → HTTP mapping
│   │   │   └── utils/
│   │   ├── prisma/
│   │   ├── auth/      users/      vendors/
│   │   ├── products/  categories/ carts/
│   │   ├── orders/    reviews/    payments/
│   │   └── admin/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── test/                      # e2e suite + disposable-DB guard
│   └── docker-compose.test.yml
└── README.md
```

### Planned 🚧

`api/` becomes `apps/api`, joined by `apps/web` (Next.js) and `packages/{types,utils,config}`
under npm workspaces.

---

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (or a managed instance)
- Docker, for the test database
- A Stripe account in test mode

### Install and run

```bash
git clone <your-repo-url> nuvita
cd nuvita/api

npm install
cp .env.example .env        # then fill it in

npx prisma migrate deploy
npx prisma generate

npm run start:dev
```

> API → `http://localhost:3000`
> Swagger → `http://localhost:3000/api/docs`

### Environment

```env
DATABASE_URL="postgresql://user:password@localhost:5432/nuvita"

JWT_SECRET="..."
JWT_REFRESH_SECRET="..."

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

PORT=3000
```

---

## Testing

```bash
npx tsc --noEmit        # type check first - it catches what Jest cannot
npm test                # 201 unit tests

npm run test:e2e:up     # start the throwaway Postgres container
npm run test:e2e        # 31 tests against a real database
npm run test:e2e:down   # tear it down
```

The end-to-end suite truncates every table before each test, so it refuses to start
unless `DATABASE_URL` points at a **loopback host** whose database name ends in `_test`.
`npm run test:e2e` supplies that URL inline; running Jest against the e2e config by hand
is blocked rather than pointed at your development database.

Coverage includes checkout, stock exhaustion, cancellation and restock, cross-user
authorization on orders, vendors, products and accounts, review eligibility, the
one-review-per-buyer database constraint, admin role gating, and DTO validation.

---

## Tech stack

### Backend

| Layer | Technology | State |
|---|---|---|
| Framework | NestJS 11 | ✅ |
| Language | TypeScript 5 | ✅ |
| ORM | Prisma 7 + `pg` driver adapter | ✅ |
| Database | PostgreSQL 16 | ✅ |
| Auth | Passport (local + JWT), bcrypt | ✅ |
| Payments | Stripe PaymentIntents + webhooks | ✅ |
| Rate limiting | `@nestjs/throttler` | ✅ |
| Docs | Swagger / OpenAPI 3 | ✅ |
| Testing | Jest, Supertest, Dockerised Postgres | ✅ |
| Cache / Queue | Redis + BullMQ | 🚧 |
| File storage | S3 / Cloudinary | 🚧 |
| Email | Nodemailer + SendGrid | 🚧 |
| Realtime | Socket.IO | 🚧 |
| Payouts | Stripe Connect | 🚧 |

### Frontend 🚧

Next.js 15 (App Router) · Tailwind CSS v4 · shadcn/ui · Zustand · TanStack Query ·
React Hook Form + Zod · Stripe.js Elements · Recharts · Vitest + Playwright

---

## Roadmap

Ordered so that migrations with wide reach land before the client that would have to
be rewritten around them.

### Next — API structure
- [ ] `/api/v1` global prefix (do this before any client exists)
- [ ] Pagination and sorting on public product and vendor listings
- [ ] Recursive category filtering, so `?categoryId=<Livestock>` includes its subtree
- [ ] Product search across name, description and category

### Then — schema with reach
- [ ] **Per-vendor order splitting** — `Order → VendorOrder → OrderItem`. Status becomes
      per-vendor, which touches checkout, cancellation, `GET /orders/vendor/:id` and
      `/admin/stats`
- [ ] **`ProductVariant`** — price and stock move down a level, which touches the cart,
      the checkout decrement and the `OrderItem` snapshot
- [ ] **Vendor approval** — `Vendor.status`; the `isVendor` flip moves to approval time
      and the ownership guards start checking it
- [ ] **`Address`** — `Order.shippingAddressId`
- [ ] **`DeliveryZone`** — vendor-scoped

### Then — infrastructure
- [ ] Redis + BullMQ for email, order processing and payouts
- [ ] S3 / Cloudinary uploads for vendor and product media
- [ ] `Notification` model + Socket.IO gateway for order status
- [ ] Stripe Connect vendor payouts
- [ ] Batch and expiry tracking — real for food, beverages and supplements, and a
      prerequisite for recalls

### Then — client
- [ ] npm workspaces restructure (`apps/api`, `apps/web`, `packages/*`)
- [ ] Next.js 15 customer, vendor and admin portals
- [ ] Stripe Elements checkout
- [ ] Mobile app (React Native / Expo)

---

## Deployment

| Service | Purpose |
|---|---|
| Neon | Managed PostgreSQL |
| Railway / Render | NestJS API |
| Vercel | 🚧 Next.js frontend |
| Upstash | 🚧 Managed Redis |
| Cloudinary | 🚧 Image storage |
| Stripe | Payments · 🚧 Connect payouts |

### Checklist

- [ ] Set all production environment variables
- [ ] `npx prisma migrate deploy` against the production database
- [ ] Point the Stripe webhook at the production URL and set `STRIPE_WEBHOOK_SECRET`
- [ ] Enable CORS for the production frontend origin
- [ ] Error monitoring (Sentry)
- [ ] Review the rate limits for production traffic

---

<div align="center">

**Nuvita** — nutrition and wellness commerce, for every species.

</div>
