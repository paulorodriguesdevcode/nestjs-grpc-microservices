import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/**
 * In-memory store — deliberate trade-off for this demo (see README):
 * the point of this repo is the gRPC/service-boundary architecture,
 * not a persistence layer. A real deployment would give each service
 * its own database.
 */
@Injectable()
export class UsersService {
  private readonly users = new Map<string, User>();

  create(name: string, email: string): User {
    const user: User = {
      id: randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }
}
