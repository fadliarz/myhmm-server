import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import GlobalExceptionHandler from './common/common-application/handler/GlobalExceptionHandler';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import AppModule from './AppModule';
import fastifyCookie from '@fastify/cookie';

config();

export default class Application {
  private _app: NestFastifyApplication;

  constructor() {}

  public async init(): Promise<void> {
    this._app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

    this._app.enableCors({
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    /**
     * Global Pipe 설정q
     */
    this._app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    /**
     * Global Exception Handler
     */
    this._app.useGlobalFilters(this._app.get(GlobalExceptionHandler));

    /**
     * Cookie
     */
    await this._app.register(fastifyCookie, {});

    /**
     * Swagger
     */
    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setDescription('The API description')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(this._app, config);
    SwaggerModule.setup('api-docs', this._app, document);

    this.startMemoryUsageLogging();
  }

  public async listen(): Promise<void> {
    await this._app.listen(process.env.PORT || 2212, '0.0.0.0');
  }

  private startMemoryUsageLogging(): void {
    setInterval(
      () => {
        const memoryUsage = process.memoryUsage();
        console.log(`Memory Usage at ${new Date().toISOString()}:`);
        console.log(
          `  RSS (Resident Set Size): ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        );
        console.log(
          `  Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        );
        console.log(
          `  Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        );
        console.log(
          `  External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        );
      },
      1000 * 60 * 15,
    );
  }
}
