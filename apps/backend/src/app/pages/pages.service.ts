import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PagesRepository } from './pages.repository';
import { type CreatePageDto, type UpdatePageDto } from './dto/page.dto';

function unwrapBlocks(stored: Prisma.JsonValue): Prisma.JsonValue[] {
  if (Array.isArray(stored)) {
    return stored;
  }
  if (
    stored !== null &&
    typeof stored === 'object' &&
    Array.isArray((stored as { blocks?: unknown }).blocks)
  ) {
    return (stored as { blocks: Prisma.JsonValue[] }).blocks;
  }
  return [];
}

@Injectable()
export class PagesService {
  constructor(private readonly pagesRepository: PagesRepository) {}

  /** Flat list (id, title, parentId, updatedAt); the client builds the tree. */
  async findAll(organizationId: number) {
    const pages =
      await this.pagesRepository.findAllByOrganization(organizationId);
    return {
      pages: pages.map((p) => ({
        id: p.id,
        title: p.title ?? 'Untitled',
        parentId: p.parentId,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  async findOne(pageId: number, organizationId: number) {
    const page = await this.pagesRepository.findByIdForOrganization(
      pageId,
      organizationId,
    );
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const subpages = await this.pagesRepository.findSubpages(
      pageId,
      organizationId,
    );

    return {
      id: page.id,
      title: page.title ?? 'Untitled',
      blocks: unwrapBlocks(page.blocks),
      version: page.version,
      parentId: page.parentId,
      updatedAt: page.updatedAt.toISOString(),
      subpages: subpages.map((s) => ({
        id: s.id,
        title: s.title ?? 'Untitled',
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  }

  async create(dto: CreatePageDto, organizationId: number, userId: number) {
    if (dto.parentId !== undefined) {
      await this.ensurePageInOrg(dto.parentId, organizationId);
    }

    const page = await this.pagesRepository.createPage({
      title: dto.title,
      parentId: dto.parentId,
      userId,
      organizationId,
    });

    return this.findOne(page.id, organizationId);
  }

  /** Update title, content, and/or parent (re-parent with cycle guard). */
  async update(pageId: number, dto: UpdatePageDto, organizationId: number) {
    const accessible = await this.pagesRepository.findAccessibleCreatedPage(
      pageId,
      organizationId,
    );
    if (!accessible) {
      throw new NotFoundException('Page not found');
    }

    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.ensurePageInOrg(dto.parentId, organizationId);
      await this.ensureNoCycle(pageId, dto.parentId, organizationId);
    }

    const data: Prisma.PageUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.blocks !== undefined) {
      const version = dto.version ?? '2.29.0';
      data.blocks = {
        time: Date.now(),
        blocks: dto.blocks,
        version,
      } as Prisma.InputJsonValue;
      data.version = version;
    }
    if (dto.parentId !== undefined) {
      data.parent =
        dto.parentId === null
          ? { disconnect: true }
          : { connect: { id: dto.parentId } };
    }

    await this.pagesRepository.updatePage(pageId, data);
    return this.findOne(pageId, organizationId);
  }

  async remove(pageId: number, organizationId: number) {
    const accessible = await this.pagesRepository.findAccessibleCreatedPage(
      pageId,
      organizationId,
    );
    if (!accessible) {
      throw new NotFoundException('Page not found');
    }
    await this.pagesRepository.deletePage(pageId);
  }

  private async ensurePageInOrg(pageId: number, organizationId: number) {
    const ok = await this.pagesRepository.pageIsInOrg(pageId, organizationId);
    if (!ok) {
      throw new NotFoundException(
        'Parent page not found or does not belong to your organization',
      );
    }
  }

  private async ensureNoCycle(
    pageId: number,
    newParentId: number,
    organizationId: number,
  ) {
    let current: number | null | undefined = newParentId;
    while (current != null) {
      if (current === pageId) {
        throw new BadRequestException(
          'Cannot move a page under one of its own subpages',
        );
      }
      current = await this.pagesRepository.getParentId(current, organizationId);
    }
  }
}
