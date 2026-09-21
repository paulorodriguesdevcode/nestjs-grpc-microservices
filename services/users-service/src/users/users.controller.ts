import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { GrpcMetricsInterceptor } from '../common/metrics';
import { UsersService } from './users.service';

@Controller()
@UseInterceptors(GrpcMetricsInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('UsersService', 'CreateUser')
  createUser(data: { name: string; email: string }) {
    return this.usersService.create(data.name, data.email);
  }

  @GrpcMethod('UsersService', 'GetUser')
  getUser(data: { id: string }) {
    const user = this.usersService.findById(data.id);
    if (!user) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `User ${data.id} not found`,
      });
    }
    return user;
  }

  @GrpcMethod('UsersService', 'ListUsers')
  listUsers() {
    return { users: this.usersService.findAll() };
  }
}
