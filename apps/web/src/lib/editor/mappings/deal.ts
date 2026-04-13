import { OutputData } from '@editorjs/editorjs';

export interface DealData {
  id: number;
  title: string;
  value?: number | null;
  currency?: string | null;
  probability?: number | null;
  stage: string;
  summary?: string | null;
  scribble?: any; // JSON
  expectedCloseDate?: string | Date | null;
  actualCloseDate?: string | Date | null;
  lostReason?: string | null;
  source?: string | null;
  priority?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  owners: Record<string, unknown>[];
}

export function dealToBlocks(deal: DealData): OutputData {
  const blocks: OutputData['blocks'] = [];

  if (deal.summary) {
    const paragraphs = deal.summary.split('\n');
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

export function blocksToDeal(output: OutputData): Partial<DealData> {
  const deal: Partial<DealData> = {};
  let summaryContent = '';

  for (const block of output.blocks) {
    if (block.type === 'paragraph') {
      summaryContent += (summaryContent ? '\n' : '') + block.data.text;
    }
  }
  
  if (summaryContent) {
    deal.summary = summaryContent;
  }

  return deal;
}
