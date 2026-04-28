import type { OutputData } from '@editorjs/editorjs';

export interface ContactData {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedinId?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  owners: Record<string, unknown>[];
}

export function contactToBlocks(contact: ContactData): OutputData {
  const blocks: OutputData['blocks'] = [];

  if (contact.notes) {
    // If notes is multiline, split by newline and create paragraphs
    const paragraphs = contact.notes.split('\n');
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

export function blocksToContact(output: OutputData): Partial<ContactData> {
  const contact: Partial<ContactData> = {};
  
  // Extract notes from paragraphs
  let notesContent = '';

  for (const block of output.blocks) {
    if (block.type === 'paragraph') {
      notesContent += (notesContent ? '\n' : '') + block.data.text;
    }
  }
  
  if (notesContent) {
    contact.notes = notesContent;
  }

  return contact;
}

