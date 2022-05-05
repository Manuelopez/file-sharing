import { NestFactory } from '@nestjs/core';
import { ClientModule } from './client.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ClientModule);
}
bootstrap();
