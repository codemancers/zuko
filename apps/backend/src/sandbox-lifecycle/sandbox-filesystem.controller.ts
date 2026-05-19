import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { RequestWithUser } from '@zuko/core';
import { PrismaService } from '../prisma/prisma.service';
import { SpritesService } from '../sprites/sprites.service';

@ApiTags('Sandboxes')
@ApiBearerAuth('session')
@Controller('sandboxes')
@UseGuards(AuthGuard)
export class SandboxFilesystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sprites: SpritesService,
  ) {}

  /**
   * GET /api/sandboxes/:id/fs/*path
   * Read a file or list a directory (?list=true) inside the sandbox.
   */
  @Get(':id/fs/*path')
  @ApiOperation({ summary: 'Read a file or list directory in a sandbox' })
  @ApiParam({ name: 'id', type: String, description: 'Sandbox ID' })
  @ApiParam({
    name: 'path',
    type: String,
    description: 'File path within sandbox',
  })
  @ApiQuery({
    name: 'list',
    required: false,
    type: Boolean,
    description: 'Set to true to list directory',
  })
  @ApiResponse({
    status: 200,
    description: 'File content or directory listing',
  })
  @ApiResponse({ status: 403, description: 'Not a chat participant' })
  @ApiResponse({ status: 404, description: 'Sandbox not found' })
  async readOrList(
    @Param('id') rawId: string,
    @Param('path') filePath: string,
    @Query('list') list: string,
    @Req() req: RequestWithUser,
  ) {
    const sandbox = await this.getAuthorizedSandbox(rawId, req);
    if (list === 'true') {
      const entries = await this.sprites.listDirectory(sandbox.name, filePath);
      return { entries };
    }
    const content = await this.sprites.readFile(sandbox.name, filePath);
    return { content };
  }

  /**
   * PUT /api/sandboxes/:id/fs/*path
   * Write content to a file inside the sandbox.
   */
  @Put(':id/fs/*path')
  @ApiOperation({ summary: 'Write content to a file in a sandbox' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'path', type: String })
  @ApiResponse({ status: 200, description: 'File written' })
  @ApiResponse({ status: 403, description: 'Not a chat participant' })
  @ApiResponse({ status: 404, description: 'Sandbox not found' })
  async writeFile(
    @Param('id') rawId: string,
    @Param('path') filePath: string,
    @Body() body: { content: string },
    @Req() req: RequestWithUser,
  ) {
    const sandbox = await this.getAuthorizedSandbox(rawId, req);
    await this.sprites.writeFile(sandbox.name, filePath, body.content);
    return { ok: true };
  }

  private async getAuthorizedSandbox(rawId: string, req: RequestWithUser) {
    const sandboxId = parseInt(rawId, 10);
    const sandbox = await this.prisma.sandbox.findUnique({
      where: { id: sandboxId },
      include: {
        chats: {
          include: { participants: true },
        },
      },
    });
    if (!sandbox) throw new NotFoundException('Sandbox not found');

    const userId = parseInt(req.user.id, 10);
    const hasAccess = sandbox.chats.some((chat) =>
      chat.participants.some((p) => p.userId === userId),
    );
    if (!hasAccess) throw new ForbiddenException();

    return sandbox;
  }
}
