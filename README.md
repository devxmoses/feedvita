<div align="center">

# FeedVita

### A multivendor marketplace connecting animal owners and farmers directly with feed suppliers

![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat-square&logo=stripe&logogitColor=white)

`npm workspaces` · `App Router` · `JWT Auth` · `BullMQ` · `Redis` · `Docker` · `Swagger`

</div>

---

## About

FeedVita is a production grade multivendor ecommerce platform built with next js and nest js to streamline the purchase and delivery of animal feeds and aims to connect animal owners and farmers directly with feed suppliers. Vendors manage their own storefronts, products, inventory, and fulfillment, customers discover and order from multiple vendors in a single checkout, this orders are automatically split per vendor behind the scenes using Prisma transactions.

---

## User Roles

| Role | Capabilities |
|---|---|
|  **CUSTOMER** | Browse by animal type, multivendor cart, track orders, leave reviews, saved addresses |
|  **Vendor** | Manage storefront, list products & variants, fulfill orders, set delivery zones, Stripe payouts |
|  **Admin** | Approve vendors, platform analytics, manage categories, handle disputes, monitor orders |

---

## Features

-  **Multivendor Storefronts** — Each vendor gets an isolated storefront with logo, banner, ratings, and custom delivery zones
-  **Order Splitting** — Single checkout splits into per-vendor orders transactionally; stock decrements atomically via `prisma.$transaction`
-  **Stripe Payments** — Payment intents, webhook handling, and vendor payouts via Stripe Connect
-  **Animal-Type Filtering** — Products tagged by animal type (cattle, poultry, swine, aquaculture, and more)
-  **Real-time Notifications** — Order status updates pushed via WebSockets; background jobs via BullMQ
-  **JWT Auth + RBAC** — Access + refresh token rotation with role guards for `CUSTOMER`, `VENDOR`, and `ADMIN` routes

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           Next.js 15 — App Router (SSR + RSC)                │
│     (customer) │ (vendor) │ (admin) │ API route handlers        │
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTPS / REST + WebSocket
┌─────────────────────────▼────────────────────────────────────┐
│              NestJS 10 — Modular REST API                     │
│    Auth │ Guards │ Interceptors │ Pipes │ Exception Filters   │
└──────┬───────────────┬───────────────────┬────────────────────┘
       │               │                   │
 ┌─────▼──────┐  ┌─────▼──────┐   ┌───────▼───────┐
 │ Prisma ORM │  │   Redis     │   │  Stripe API   │
 │            │  │  + BullMQ   │   │               │
 └─────┬──────┘  └────────────┘   └───────────────┘
       │
 ┌─────▼──────┐
 │ PostgreSQL │
 └────────────┘
```

### Architectural Patterns

- **Monorepo** via `npm workspaces` (`apps/api`, `apps/web`, `packages/*`)
- **Domain-driven modules** in NestJS — one module per business domain
- **Repository pattern** abstracted via a global `PrismaService`
- **JWT refresh token rotation** — short-lived access tokens (15m) + hashed refresh tokens (7d)
- **Atomic order splitting** — cart items grouped by vendor inside a single `$transaction`
- **BullMQ queues** for async jobs: email, order processing, Stripe payouts

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript 5 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis + BullMQ |
| Auth | Passport.js + JWT |
| Payments | Stripe |
| File Storage | AWS S3 / Cloudinary |
| Email | Nodemailer + SendGrid |
| Docs | Swagger (OpenAPI 3) |
| Testing | Jest + Supertest |

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| State | Zustand |
| Data Fetching | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Payments | Stripe.js Elements |
| Charts | Recharts |
| Testing | Vitest + Playwright |

---

## Repository Structure

```
feedmart/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/               # Shared utilities
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/
│   │   │   ├── config/
│   │   │   ├── prisma/
│   │   │   └── modules/
│   │   │       ├── auth/
│   │   │       ├── users/
│   │   │       ├── vendors/
│   │   │       ├── products/
│   │   │       ├── categories/
│   │   │       ├── orders/
│   │   │       ├── payments/
│   │   │       ├── reviews/
│   │   │       ├── notifications/
│   │   │       ├── uploads/
│   │   │       └── admin/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── Dockerfile
│   │
│   └── web/                          # Next.js Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   ├── (customer)/
│       │   │   ├── (vendor)/
│       │   │   └── (admin)/
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui primitives
│       │   │   ├── customer/
│       │   │   ├── vendor/
│       │   │   └── admin/
│       │   ├── lib/
│       │   ├── hooks/
│       │   ├── stores/               # Zustand stores
│       │   └── types/
│       └── Dockerfile
│
├── packages/
│   ├── types/                        # Shared TypeScript types
│   ├── utils/                        # Shared utilities
│   └── config/                       # Shared eslint/tsconfig
│
├── docker-compose.yml
├── npm-workspace.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Docker + Docker Compose
- Stripe account (for payments)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/feedmart.git
cd feedmart

# Install all dependencies
npm install

# Start Postgres + Redis via Docker
docker-compose up -d

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Run database migrations
cd apps/api
npx prisma migrate dev
npx prisma generate

# (Optional) Seed categories and test data
npx prisma db seed

# Start all apps from root
cd ../..
npm dev
```

> API → `http://localhost:3001/api/v1`  
> Web → `http://localhost:3000`  
> Swagger Docs → `http://localhost:3001/api/docs`

---

## Environment Variables

### `apps/api/.env`

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/feedmart"

# JWT
JWT_ACCESS_SECRET="your-super-secret-access-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AWS S3
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="feedmart-uploads"

# Redis
REDIS_URL="redis://localhost:6379"

# App
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Full interactive docs available at `/api/docs` (Swagger UI).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user |
| `POST` | `/auth/login` | Public | Login |
| `POST` | `/auth/refresh` | Refresh Token | Rotate access token |
| `POST` | `/auth/logout` | JWT | Invalidate refresh token |
| `GET` | `/products` | Public | List products (paginated, filterable) |
| `GET` | `/products/:slug` | Public | Product detail with reviews |
| `POST` | `/products` | Vendor | Create product |
| `PATCH` | `/products/:id` | Vendor | Update own product |
| `DELETE` | `/products/:id` | Vendor | Soft-delete product |
| `GET` | `/vendors/:slug` | Public | Vendor storefront |
| `POST` | `/vendors/apply` | JWT | Apply to become a vendor |
| `GET` | `/orders` | JWT | Authenticated user's orders |
| `POST` | `/orders` | CUSTOMER | Place order (multi-vendor cart) |
| `PATCH` | `/orders/vendor/:id/status` | Vendor | Update vendor order status |
| `POST` | `/payments/create-intent` | CUSTOMER | Create Stripe payment intent |
| `POST` | `/payments/webhook` | Stripe | Stripe webhook handler |
| `GET` | `/categories` | Public | List all categories |
| `POST` | `/reviews` | CUSTOMER | Post a product review |
| `GET` | `/admin/vendors` | Admin | List all vendors |
| `PATCH` | `/admin/vendors/:id/approve` | Admin | Approve vendor |
| `GET` | `/admin/stats` | Admin | Platform analytics |

---

## Database Schema

```
User (CUSTOMER | VENDOR | ADMIN)
 ├── Vendor (1:1)
 │    ├── Product (1:N)
 │    │    └── ProductVariant (1:N)
 │    ├── VendorOrder (1:N)
 │    │    └── OrderItem (1:N)
 │    └── DeliveryZone (1:N)
 ├── Order (1:N)  ←── top-level customer order
 │    └── VendorOrder (1:N)  ←── one per vendor in cart
 ├── Review (1:N)
 ├── Address (1:N)
 └── Notification (1:N)

Category (self-referential tree for subcategories)
 └── Product (N:1)
```

---

## Authentication Flow

```
1. POST /auth/register or /auth/login
      └── returns accessToken (15min) + refreshToken (7d)

2. Every API request
      └── Authorization: Bearer <accessToken>

3. On 401 Unauthorized
      └── POST /auth/refresh with refreshToken → new token pair

4. POST /auth/logout
      └── refresh token nullified in DB → session invalidated
```

Role guards are applied per route using `@Roles()` decorator + `RolesGuard`:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR)
@Post('products')
createProduct() {}
```

---

## Deployment

### Recommended Services

| Service | Purpose |
|---|---|
| Vercel | Next.js frontend |
| Railway / Render | NestJS API |
| Neon / Supabase | Managed PostgreSQL |
| Upstash | Managed Redis |
| Cloudinary | Image storage |
| Stripe | Payments + vendor payouts |

### Checklist

- [ ] Set all production environment variables
- [ ] Run `npx prisma migrate deploy` on production DB
- [ ] Configure Stripe webhook endpoint to production URL
- [ ] Enable CORS for production frontend domain
- [ ] Set up error monitoring (e.g. Sentry)
- [ ] Configure API rate limiting
- [ ] Enable Stripe Connect for vendor payouts

---

## What This Project Demonstrates

**Backend (NestJS)**
- Domain driven modular architecture
- JWT auth with refresh token rotation
- Complex Prisma transactions (multi-vendor order splitting)
- Role based access control (RBAC)
- Stripe payment integration with webhooks
- File uploads to S3/Cloudinary
- Swagger/OpenAPI documentation

**Frontend (Next.js)**
- App Router with server and client components
- Multi portal UX: customer, vendor, and admin dashboards
- Optimistic updates with TanStack Query
- Form validation with Zod + React Hook Form
- Stripe Elements checkout integration
- Realtime order status updates via WebSockets

**Database Design**
- Normalized schema with proper relational integrity
- Self referential category trees
- Multi vendor order splitting pattern
- Soft deletes for products

---

## Roadmap

- [ ] Realtime customer to vendor chat (Socket.IO)
- [ ] Push notifications (Firebase FCM)
- [ ] Delivery tracking with Google Maps API
- [ ] Product recommendation engine by animal type
- [ ] Vendor analytics dashboard with charts
- [ ] Mobile app (React Native / Expo)

---

<div align="center">

Built with ❤️ for portfolio demonstration

**FeedMart** connecting farmers with feed suppliers across Africa 🌍

</div>
