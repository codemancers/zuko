import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectMediaType, MAX_FILE_BYTES, safeFilename } from './file-types';
import { createLocalStorage, FileTooLargeError } from './storage';

async function* chunks(...parts: Buffer[]) {
  for (const p of parts) yield p;
}

describe('local storage', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'zuko-files-'));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('stores, reads back and deletes bytes', async () => {
    const storage = createLocalStorage(root);
    const result = await storage.put('org1/abc', chunks(Buffer.from('%PDF-1.7 '), Buffer.from('hello')));
    expect(result.size).toBe(14);
    const out: Buffer[] = [];
    for await (const c of await storage.get('org1/abc')) out.push(c as Buffer);
    expect(Buffer.concat(out).toString()).toBe('%PDF-1.7 hello');
    await storage.delete('org1/abc');
    await expect(storage.get('org1/abc')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a file over the cap and leaves nothing behind', async () => {
    const storage = createLocalStorage(root);
    const big = Buffer.alloc(MAX_FILE_BYTES + 1);
    await expect(storage.put('org2/big', chunks(big))).rejects.toBeInstanceOf(FileTooLargeError);
    expect(await readdir(join(root, 'org2'))).toEqual([]);
  });

  it('accepts a file of exactly the cap', async () => {
    const storage = createLocalStorage(root);
    const result = await storage.put('org3/max', chunks(Buffer.alloc(MAX_FILE_BYTES)));
    expect(result.size).toBe(MAX_FILE_BYTES);
    expect((await readFile(join(root, 'org3/max'))).length).toBe(MAX_FILE_BYTES);
  });

  it('refuses keys that could escape the root', async () => {
    const storage = createLocalStorage(root);
    for (const key of ['../x', '/etc/passwd', 'a/../../b', 'a//b', '']) {
      await expect(storage.put(key, chunks(Buffer.from('x')))).rejects.toThrow('Invalid storage key');
    }
  });
});

// A minimal real .xlsx (a zip with [Content_Types].xml, _rels/.rels and xl/workbook.xml).
const XLSX = Buffer.from('UEsDBBQAAAAIAHSIel10vYL2rgAAAOkAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2PsQ7CMAxEf6XKihoXBgbUloEdGPgBk7o0ahNHiSnl70lhYzpZp3t3ro+Lm4qZYrLsG7XVlTq29e0dKBXZ8alRg0g4ACQzkMOkOZDPTs/RoeQzPiCgGfFBsKuqPRj2Ql5KWRmqrS8ZHm1HxRWjnNFRo2CZ4MVxvDOPOrNUcfqF1t5GYQiTNSh5Ecy++2ssue+toY7N0+WITiESdmkgEjfpr2qH1m9WMLQ1fJ9pP1BLAwQUAAAACAB0iHpdKFH52VwAAABqAAAACwAAAF9yZWxzLy5yZWxzTYzLDYAgEAVbIRTgogcPhk8PdrAhqxj5hSXG8uXo8c1MnnZviuKhxlfJRs6Tks7qnSL2AThclcUoMhsZeq8bAPtACXkqlfIwR2kJ+5jthIr+xpNgUWqF9v+QYD9QSwMEFAAAAAgAdIh6Xc6emBMNAAAACwAAAA8AAAB4bC93b3JrYm9vay54bWyzKc8vyk7Kz8/WtwMAUEsBAhQDFAAAAAgAdIh6XXS9gvauAAAA6QAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACAB0iHpdKFH52VwAAABqAAAACwAAAAAAAAAAAAAAgAHfAAAAX3JlbHMvLnJlbHNQSwECFAMUAAAACAB0iHpdzp6YEw0AAAALAAAADwAAAAAAAAAAAAAAgAFkAQAAeGwvd29ya2Jvb2sueG1sUEsFBgAAAAADAAMAtwAAAJ4BAAAAAA==', 'base64');
// A byte stream, like the one storage hands back (Readable.from would make an object-mode one).
const stream = (bytes: Buffer) => Readable.from([bytes], { objectMode: false });
const detect = (bytes: Buffer, declared: string) => detectMediaType(stream(bytes), declared);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

describe('detectMediaType', () => {
  it('identifies by bytes, ignoring a lying declared type', async () => {
    expect(await detect(PNG, 'text/html')).toBe('image/png');
    expect(await detect(Buffer.from('%PDF-1.4'), 'text/html')).toBe('application/pdf');
    expect(await detect(Buffer.from('<script>alert(1)</script>'), 'image/png')).toBe('application/octet-stream');
    expect(await detect(Buffer.from('<html>'), 'text/html')).toBe('application/octet-stream');
  });

  it('recognizes an Office document, which a few leading bytes cannot', async () => {
    expect(await detect(XLSX, 'application/octet-stream')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(await detect(XLSX.subarray(0, 16), '')).toBe('application/zip');
  });

  it('keeps plain-data declared types', async () => {
    expect(await detect(Buffer.from('a,b'), 'text/csv; charset=utf-8')).toBe('text/csv');
  });

  it('closes the stream it was given', async () => {
    const open = stream(Buffer.from('%PDF-1.4'));
    await detectMediaType(open, '');
    expect(open.destroyed).toBe(true);
  });
});

describe('safeFilename', () => {
  it('strips paths and control characters', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\x\\report.pdf')).toBe('report.pdf');
    expect(safeFilename('a\r\nb.txt')).toBe('ab.txt');
    expect(safeFilename('..')).toBe('attachment');
    expect(safeFilename('   ')).toBe('attachment');
    expect(safeFilename('x'.repeat(300))).toHaveLength(180);
  });
});
