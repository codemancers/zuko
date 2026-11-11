import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Auth, createAuth } from './auth';

@Injectable()
export class AuthService {
  readonly auth: Auth;

  constructor(prisma: PrismaService) {
    this.auth = createAuth(prisma);
  }
}
