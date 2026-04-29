import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export abstract class BaseService {
  protected readonly logger: Logger;

  constructor(serviceName: string) {
    this.logger = new Logger(serviceName);
  }
}
