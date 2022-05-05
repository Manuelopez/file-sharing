import {
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { User } from './user';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private users: User[] = [];
  private rooms: [User, User][] = [];

  @WebSocketServer()
  server: Server;

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.users = this.users.filter((user) => client.id !== user.socketId);

    for (let room of this.rooms) {
      if (room[0].socketId === client.id) {
        room[0].socketId = null;
      }
      if (room[1].socketId === client.id) {
        room[1].socketId = null;
      }
    }

    this.rooms = this.rooms.filter(
      (room) => room[0] !== null && room[1] !== null,
    );
  }

  handleConnection(@ConnectedSocket() client: Socket, ...args: any[]) {
    console.log(client.id);
  }

  @SubscribeMessage('joinServer')
  async joinServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    console.log(client.id);
    const user = new User(client.id, payload.username);
    this.users.push(user);
    const allUsers = this.users.filter((user) => user.socketId !== client.id);
    this.server.to(client.id).emit('joined', { users: allUsers });
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const sharingUser = this.users.find(
      (user) => user.socketId === payload.joinRoomWith,
    );

    if (!sharingUser) {
      this.server
        .to(client.id)
        .emit('userNotFound', { error: 'user not found' });
      return true;
    }

    this.server.to(payload.joinRoomWith).emit('userWantsToJoinRoom', {
      users: { u1: client.id, u2: payload.joinRoomWith },
    });
    return true;
  }

  @SubscribeMessage('acceptJoinRoom')
  async acceptJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const u1 = this.users.find((user) => user.socketId === payload.users.u1);
    const u2 = this.users.find((user) => user.socketId === payload.users.u2);

    // todo could not find users

    const room: [User, User] = [u1, u2];
    this.rooms.push(room);
    console.log(payload.users.u1);
    console.log(payload.users.u2);
    for (let user of room) {
      this.server.to(user.socketId).emit('joinedRoom', { ok: true });
    }
  }

  @SubscribeMessage('wantsToShare')
  async wantsToShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const room = this.rooms.find(
      (room) =>
        room[0].socketId === client.id || room[1].socketId === client.id,
    );

    const userToSend = room[0].socketId === client.id ? room[1] : room[0];
    this.server
      .to(userToSend.socketId)
      .emit('peerWantsToShare', { files: payload.files });

    return true;
  }

  @SubscribeMessage('acceptFiles')
  async acceptFiles(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    console.log('ran');
    const room = this.rooms.find(
      (room) =>
        room[0].socketId === client.id || room[1].socketId === client.id,
    );
    const userToSend = room[0].socketId === client.id ? room[1] : room[0];
    this.server.to(userToSend.socketId).emit('peerAcceptsFiles');
    return true;
  }

  @SubscribeMessage('rejectFlies')
  async rejectFiles(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const room = this.rooms.find(
      (room) =>
        room[0].socketId === client.id || room[1].socketId === client.id,
    );

    const userToSend = room[0].socketId === client.id ? room[1] : room[0];
    this.server.to(userToSend.socketId).emit('peerRejectsFiles');
  }

  @SubscribeMessage('Share')
  async share(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const room = this.rooms.find(
      (room) =>
        room[0].socketId === client.id || room[1].socketId === client.id,
    );
    const userToSend = room[0].socketId === client.id ? room[1] : room[0];

    this.server.to(userToSend.socketId).emit('peerShares', payload);
  }
}
