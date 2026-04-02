import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically strip away any properties not defined in the DTO
      forbidNonWhitelisted: true, // Throw an error if the user sends extra data they shouldn't
      transform: true, // Automatically transform incoming payloads into DTO instances
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
