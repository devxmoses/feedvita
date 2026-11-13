import { INestApplication, ValidationPipe } from "@nestjs/common";

export function configureApp(app: INestApplication){
    app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));

    app.setGlobalPrefix('api/v1', { exclude: ['health']});

    return app;
}