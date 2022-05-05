import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ManagerOptions, SocketOptions } from 'socket.io-client';
import { IoClientModule } from 'nestjs-io-client';

@Module({
  imports: [
    IoClientModule.forRoot({
      uri: 'ws://localhost:3000',
      options: {},
    }),
  ],
  controllers: [],
  providers: [ClientService],
})
export class ClientModule {}
