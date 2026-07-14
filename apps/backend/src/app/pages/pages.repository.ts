import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Flat org-wide listing; the client builds the tree from `parentId`. */
  async findAllByOrganization(organizationId: number) {
    return this.prisma.page.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        parentId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Fetch a single page by id, scoped to the organization (detail view). */
  async findByIdForOrganization(pageId: number, organizationId: number) {
    return this.prisma.page.findFirst({
      where: { id: pageId, organizationId },
      select: {
        id: true,
        title: true,
        blocks: true,
        version: true,
        parentId: true,
        createdBy: true,
        updatedAt: true,
      },
    });
  }

  /** Direct children of a page (subpage links on the detail view). */
  async findSubpages(parentId: number, organizationId: number) {
    return this.prisma.page.findMany({
      where: { parentId, organizationId },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Insert a new standalone page. */
  async createPage(input: {
    title?: string | null;
    parentId?: number | null;
    userId: number;
    organizationId: number;
  }) {
    return this.prisma.page.create({
      data: {
        title: input.title ?? null,
        blocks: { time: Date.now(), blocks: [], version: '2.29.0' },
        version: '2.29.0',
        createdBy: input.userId,
        organizationId: input.organizationId,
        parentId: input.parentId ?? null,
      },
      select: { id: true },
    });
  }

  /** Write-permission gate for PATCH and MCP writes. */
  async findAccessibleCreatedPage(pageId: number, organizationId: number) {
    return this.prisma.page.findFirst({
      where: { id: pageId, organizationId },
      select: { id: true, blocks: true },
    });
  }

  /** True if the page exists within the organization (parent guard). */
  async pageIsInOrg(pageId: number, organizationId: number) {
    const found = await this.prisma.page.findFirst({
      where: { id: pageId, organizationId },
      select: { id: true },
    });
    return Boolean(found);
  }

  /** parentId of an org page, or undefined if the page isn't in the org. */
  async getParentId(pageId: number, organizationId: number) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, organizationId },
      select: { parentId: true },
    });
    return page?.parentId;
  }

  async updatePage(pageId: number, data: Prisma.PageUpdateInput) {
    return this.prisma.page.update({
      where: { id: pageId },
      data,
      select: { id: true },
    });
  }

  /** Delete a page; DB cascade removes the subtree. */
  async deletePage(pageId: number) {
    await this.prisma.page.delete({ where: { id: pageId } });
  }
}
