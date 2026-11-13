import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CatchEveryFilter } from './common/filters/catch-everything.filter';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CartsModule } from './carts/carts.module';
import { CategoriesModule } from './categories/categories.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PaymentsModule } from './payments/payments.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { SpeciesModule } from './species/species.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit:100,
      }
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    VendorsModule,
    ProductsModule,
    OrdersModule,
    CartsModule,
    CategoriesModule,
    ReviewsModule,
    PaymentsModule,
    AdminModule,
    SpeciesModule
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: CatchEveryFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard},
  ],
})
export class AppModule {}
