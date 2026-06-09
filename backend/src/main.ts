import 'reflect-metadata';
import {Logger, ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {runMigrations} from './infra/migrate';

async function bootstrap(): Promise<void> {
  if (process.env.RUN_MIGRATIONS_ON_STARTUP !== 'false') {
    await runMigrations();
    Logger.log('migrations applied', 'Bootstrap');
  }

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));

  const origins = process.env.ALLOWED_ORIGINS ?? '*';
  app.enableCors({origin: origins === '*' ? true : origins.split(',')});

  const port = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
