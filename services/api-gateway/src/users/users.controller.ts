import { Body, Controller, Get, Inject, OnModuleInit, Param, Post } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UsersServiceClient } from '../clients/clients.interfaces';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController implements OnModuleInit {
  private usersClient!: UsersServiceClient;

  constructor(@Inject('USERS_PACKAGE') private readonly usersGrpc: ClientGrpc) {}

  onModuleInit() {
    this.usersClient = this.usersGrpc.getService<UsersServiceClient>('UsersService');
  }

  @Post()
  createUser(@Body() dto: CreateUserDto) {
    return firstValueFrom(this.usersClient.createUser(dto));
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return firstValueFrom(this.usersClient.getUser({ id }));
  }

  @Get()
  async listUsers() {
    const { users } = await firstValueFrom(this.usersClient.listUsers({}));
    return users;
  }
}
