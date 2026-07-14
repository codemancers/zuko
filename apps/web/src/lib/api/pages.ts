import { apiClient } from '../api-client';

/**
 * Wiki pages API — mirrors the backend PagesController
 * (apps/backend/src/app/pages). List is flat (tree via parentId);
 * detail carries Editor.js blocks + immediate subpages.
 */

/** Editor.js block (the shape WikiEditor saves and the MCP tools exchange). */
export interface EditorJsBlock {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

export interface PageListItem {
  id: number;
  title: string;
  parentId: number | null;
  updatedAt: string;
}

export interface PageSubpage {
  id: number;
  title: string;
  updatedAt: string;
}

export interface PageDetail {
  id: number;
  title: string;
  blocks: EditorJsBlock[];
  version: string;
  parentId: number | null;
  updatedAt: string;
  subpages: PageSubpage[];
}

export interface PagesListResponse {
  pages: PageListItem[];
}

export interface CreatePageDto {
  title?: string;
  parentId?: number;
}

/**
 * Omitting a field leaves it unchanged. `parentId: null` moves the page to
 * top level. `blocks` is a full replacement (Editor.js saves whole documents).
 */
export interface UpdatePageDto {
  title?: string | null;
  parentId?: number | null;
  blocks?: EditorJsBlock[];
  version?: string;
}

export const pagesApi = {
  async getPages(): Promise<PagesListResponse> {
    return apiClient.get<PagesListResponse>('/pages');
  },

  async getPage(id: number): Promise<PageDetail> {
    return apiClient.get<PageDetail>(`/pages/${id}`);
  },

  async createPage(data: CreatePageDto): Promise<PageDetail> {
    return apiClient.post('/pages', data);
  },

  async updatePage(id: number, data: UpdatePageDto): Promise<PageDetail> {
    return apiClient.patch(`/pages/${id}`, data);
  },

  async deletePage(id: number): Promise<void> {
    return apiClient.delete(`/pages/${id}`);
  },
};
