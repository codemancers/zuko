import { attachmentError } from 'eve/channels';
import type { FetchFileFunction } from 'eve/channels';
import { backendFetch, backendUrl } from './backend';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Largest file `get_file` opens: eve shows the model PDFs up to 20 MiB and images up to 3 MiB. */
export const MAX_OPEN_BYTES = 20 * 1024 * 1024;
export const MAX_MESSAGE_FILES = 10;

/**
 * The file id in one of Zuko's own file URLs, or undefined for anything else. Only this exact shape is
 * recognized: same origin as the backend, no credentials, query or fragment. Other URLs are never fetched.
 */
export function fileIdFromUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    const match = /^\/api\/v1\/files\/([1-9]\d{0,18})\/content$/.exec(url.pathname);
    return url.origin === new URL(backendUrl).origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? match?.[1]
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * File bytes never travel inside a message: a file part must point at a file already uploaded to Zuko.
 * Returns what is wrong with the message's file parts, one entry per offending part (empty when fine).
 */
export function fileProblems(message: unknown): string[] {
  if (!Array.isArray(message)) return [];
  const files = message.filter(
    (part): part is { type: 'file'; data: unknown; filename?: unknown } =>
      !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'file',
  );
  const problems = files.flatMap((part, index) =>
    fileIdFromUrl(part.data) === undefined
      ? [
          `File ${typeof part.filename === 'string' ? `"${part.filename}"` : index + 1} must be uploaded to Zuko first and sent by its link, never as inline content`,
        ]
      : [],
  );
  if (files.length > MAX_MESSAGE_FILES)
    problems.push(`A message can carry at most ${MAX_MESSAGE_FILES} files`);
  return problems;
}

/** Loads a Zuko file for an incoming message, as the signed-in user, so the backend decides who may read it. */
export const resolveUploadedFile: FetchFileFunction = async (url, context) => {
  const id = fileIdFromUrl(url);
  // Only our own files: eve is never asked to fetch anything else.
  if (!id) throw attachmentError('Only files uploaded to Zuko can be attached.');
  if (!context) throw attachmentError('Sign in to attach files.');
  let response;
  try {
    response = await backendFetch(context, `files/${id}/content`, {
      method: 'GET',
      json: false,
      timeoutMs: 60_000,
    });
  } catch {
    throw attachmentError('Sign in to attach files.');
  }
  if (!(response instanceof Response))
    throw attachmentError('Zuko could not authorize reading this file.');
  if (!response.ok) throw attachmentError('This file is unavailable, or you cannot read it.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) throw attachmentError('Files must be 25 MB or smaller.');
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  let filename: string | undefined;
  try {
    filename = encoded ? decodeURIComponent(encoded) : undefined;
  } catch {
    filename = undefined;
  }
  return {
    bytes,
    mediaType: response.headers.get('content-type') ?? 'application/octet-stream',
    ...(filename ? { filename } : {}),
  };
};
