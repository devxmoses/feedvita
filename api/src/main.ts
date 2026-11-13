import { NestFactory} from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule} from '@nestjs/swagger'
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {rawBody:true});
  configureApp(app); 

  const config = new DocumentBuilder()
    .setTitle('Nuvita API')
    .setDescription('Multi vendor marketplace API for food, beverages, wellness products and ' +
      'equipment, for people, pets and livestock'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
