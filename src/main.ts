import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  /**
   * bufferLogs: true — holds all log output in an internal buffer
   * until app.useLogger() is called below. Without this, the NestJS
   * bootstrap messages (DI graph resolution, route registration) are
   * emitted through the default console logger before Pino is wired up,
   * producing mixed log formats at startup.
   */
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Step 4: Replace the default logger with the Pino instance ──────────
  // The Logger token is provided by LoggerModule (configured in AppModule).
  // Flush the startup buffer through Pino so all bootstrap output is JSON.
  app.useLogger(app.get(Logger));

  // ── Global validation pipeline ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip undeclared properties
      forbidNonWhitelisted: true, // 400 on extra properties
      transform: true, // materialise DTOs + activate @Type / @Transform
    }),
  );

  // ── Step 2: Graceful shutdown ──────────────────────────────────────────
  //
  // enableShutdownHooks() registers handlers for POSIX signals
  // (SIGTERM, SIGINT). When Kubernetes sends SIGTERM during a rolling
  // deploy the lifecycle plays out as follows:
  //
  //   1. K8s removes the Pod from the Service endpoints (new traffic stops).
  //   2. K8s sends SIGTERM to PID 1.
  //   3. NestJS calls onModuleDestroy() / beforeApplicationShutdown() on
  //      every module that implements those hooks — TypeORM closes its
  //      connection pool here.
  //   4. NestJS calls app.close() which drains in-flight HTTP requests
  //      before the process exits with code 0.
  //
  // Without this, the process exits mid-request, Postgres sees abrupt
  // disconnects, and rolling deploys can cause 503s.
  app.enableShutdownHooks();

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:8081'];

  // ── Enable CORS for specific origins ───────────────────────────────────
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
