import type { OutputData } from '@editorjs/editorjs';

export interface CompanyData {
  id: number;
  companyName: string;
  website?: string | null;
  linkedinUrl?: string | null;
  summary?: string | null;
  scribble?: any; // JSON
  createdAt: string | Date;
  updatedAt: string | Date;
  owners: Record<string, unknown>[];
}

export function companyToBlocks(company: CompanyData): OutputData {
  const blocks: OutputData['blocks'] = [];

  if (company.summary) {
    const paragraphs = company.summary.split('\n');
    paragraphs.forEach(p => {
      if (p.trim()) {
        blocks.push({
          type: 'paragraph',
          data: {
            text: p.trim(),
          },
        });
      }
    });
  }

  return {
    time: 0,
    blocks,
    version: '2.31.0',
  };
}

export function blocksToCompany(output: OutputData): Partial<CompanyData> {
  const company: Partial<CompanyData> = {};
  let summaryContent = '';

  for (const block of output.blocks) {
    if (block.type === 'paragraph') {
      summaryContent += (summaryContent ? '\n' : '') + block.data.text;
    }
  }
  
  if (summaryContent) {
    company.summary = summaryContent;
  }

  return company;
}
