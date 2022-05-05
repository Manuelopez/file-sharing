import { Inject, Injectable } from '@nestjs/common';
import {
  InjectIoClientProvider,
  IoClient,
  OnConnect,
  OnConnectError,
  EventListener,
} from 'nestjs-io-client';

import { Socket } from 'socket.io-client';
import * as inquirer from 'inquirer';
import { User } from 'apps/file-sharing/src/user';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

type Status = 'hall' | 'inRoom' | 'connected';

@Injectable()
export class ClientService {
  private prompt: any;
  private status: Status = 'hall';
  private theFilesToShare: string[] = [];
  private directoryToAcceptFiles: string = '';
  constructor(@InjectIoClientProvider() private readonly socket: IoClient) {}

  @OnConnect()
  async onConnect() {
    this.prompt = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'whats your username',
      },
    ]);

    this.socket.emit('joinServer', { username: this.prompt.username });
    this.status = 'connected';
    console.log();
  }

  @EventListener('joined')
  async joined(payload: { users: User[] }) {
    this.status = 'hall';

    const users = payload.users.map((user) => ({
      name: user.username,
      value: user.socketId,
    }));
    if (users.length === 0) {
      this.prompt = await inquirer.prompt([
        {
          type: 'list',
          name: 'user',
          message: 'Choose Who To Share With',
          choices: [{ name: 'No Users', value: '0' }],
        },
      ]);
    } else {
      this.prompt = await inquirer.prompt([
        {
          type: 'list',
          name: 'user',
          message: 'Choose Who To Share With',
          choices: users,
        },
      ]);
      this.socket.emit('joinRoom', { joinRoomWith: this.prompt.user });
    }
  }

  @EventListener('userWantsToJoinRoom')
  async userWantsToJoinRoom(payload: { users: { u1: string; u2: string } }) {
    console.log(payload.users.u1);

    this.prompt = await inquirer.prompt([
      {
        type: 'list',
        name: 'accept',
        message: 'user wants to join rooms',
        choices: [
          { name: 'yes', value: 'yes' },
          { name: 'no', value: 'no' },
        ],
      },
    ]);
    console.log(this.prompt);
    if (this.prompt.accept === 'yes') {
      this.socket.emit('acceptJoinRoom', {
        users: { u1: payload.users.u1, u2: payload.users.u2 },
      });
    } else {
      //todo reaject files
    }
  }

  @EventListener('joinedRoom')
  async joinedRoom() {
    let currentDir = `${os.homedir()}/Desktop`;
    this.prompt = await inquirer.prompt([
      {
        type: 'list',
        name: 'share',
        message: 'What Do You Want To Do',
        choices: ['share', 'recieve'],
      },
    ]);
    if (this.prompt.share === 'share') {
      while (true) {
        const files = fs
          .readdirSync(currentDir, { withFileTypes: true })
          .filter((file) => file.isDirectory())
          .map((file) => ({
            name: file.name,
            value: { name: file.name },
          }));

        files.unshift({
          name: 'User This Dir',
          value: { name: 'current' },
        });
        files.unshift({
          name: 'Go To Parent Dir',
          value: { name: 'parent' },
        });

        this.prompt = await inquirer.prompt([
          { type: 'list', name: 'dir', message: 'Choose Dir', choices: files },
        ]);

        if (this.prompt.dir.name === 'current') {
          break;
        }
        if (this.prompt.dir.name === 'parent') {
          currentDir = path.join(currentDir, '../');
        } else {
          currentDir = `${currentDir}/${this.prompt.dir.name}`;
        }
      }

      const files = fs
        .readdirSync(currentDir, { withFileTypes: true })
        .filter((file) => !file.isDirectory())
        .map((file) => ({
          name: file.name,
          value: { name: file.name },
        }));

      this.prompt = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'files',
          message: 'Choose Files',
          choices: files,
        },
      ]);

      console.log(this.prompt);
      this.theFilesToShare = this.prompt.files.map(
        (file) => `${currentDir}/${file.name}`,
      );
      this.socket.emit('wantsToShare', { files: this.prompt.files });
      console.log('Waiting for answer');
    } else {
      console.log('wating');
    }
  }

  @EventListener('peerWantsToShare')
  async peerWantsToShare(payload: { files: string[] }) {
    console.log('User Wants to Share Files');
    for (let file of payload.files) {
      console.log(`\t ${file}`);
    }
    this.prompt = await inquirer.prompt([
      {
        type: 'list',
        name: 'accept',
        message: 'Do You Want to Accept Files',
        choices: [
          { name: 'yes', value: 'yes' },
          { name: 'no', value: 'no' },
        ],
      },
    ]);

    console.log(this.prompt);

    if (this.prompt.accept === 'yes') {
      console.log('asiodh;aodfhao;ifha;ofihna');
      let currentDir = `${os.homedir()}/Desktop`;
      while (true) {
        const files = fs
          .readdirSync(currentDir, { withFileTypes: true })
          .filter((file) => file.isDirectory())
          .map((file) => ({
            name: file.name,
            value: { name: file.name },
          }));

        files.unshift({
          name: 'User This Dir',
          value: { name: 'current' },
        });
        files.unshift({
          name: 'Go To Parent Dir',
          value: { name: 'parent' },
        });

        this.prompt = await inquirer.prompt([
          { type: 'list', name: 'dir', message: 'Choose Dir', choices: files },
        ]);

        if (this.prompt.dir.name === 'current') {
          break;
        }
        if (this.prompt.dir.name === 'parent') {
          currentDir = path.join(currentDir, '../');
        } else {
          currentDir = `${currentDir}/${this.prompt.dir.name}`;
        }
      }

      this.directoryToAcceptFiles = currentDir;
      console.log(currentDir);

      this.socket.emit('acceptFiles', {});

      console.log('waiting');
    } else {
      // TODO REJECT FILES
    }
  }

  @EventListener('peerAcceptsFiles')
  async peerAcceptsFiles() {
    // var readStream = fs.createReadStream(, chunks = [];
    console.log(this.theFilesToShare);
    for (let file of this.theFilesToShare) {
      let fileSize = fs.statSync(file).size;
      console.log(fileSize);
      let readStream = fs.createReadStream(file);
      readStream.on('data', (chunk) => {
        const fileName = file.split('/');
        this.socket.emit('Share', {
          file: fileName[fileName.length - 1],
          chunk,
        });
      });
    }
  }

  @EventListener('peerShares')
  async peerShares(payload: { file: string; chunk: any }) {
    console.log('writing file');
    fs.appendFile(
      `${this.directoryToAcceptFiles}/${payload.file}`,
      payload.chunk,
      function (err) {
        if (err) throw err;
      },
    );
  }
}
