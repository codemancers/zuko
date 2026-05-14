import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SpritesService } from '../sprites/sprites.service';
import { SandboxLifecycleService } from './sandbox-lifecycle.service';
import { SandboxLifecycleEventsController } from './sandbox-lifecycle-events.controller';
import { SandboxFilesystemController } from './sandbox-filesystem.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SandboxLifecycleEventsController, SandboxFilesystemController],
  providers: [SpritesService, SandboxLifecycleService],
  exports: [SandboxLifecycleService, SpritesService],
})
export class SandboxLifecycleModule {}
