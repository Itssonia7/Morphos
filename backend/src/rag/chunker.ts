import { Document } from '@langchain/core/documents';
import { config } from '../config.js';
import type { KnowledgeChunkMetadata, KnowledgeContentType } from './types.js';

export class RagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RagValidationError';
  }
}

export interface ChunkDocumentInput {
  documentId?: string;
  sourceName: string;
  content: string;
  userId: string;
  projectId?: string;
  investigationId?: string;
  contentType?: KnowledgeContentType;
  section?: string;
  page?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface PreparedChunk {
  content: string;
  metadata: KnowledgeChunkMetadata;
  document: Document<KnowledgeChunkMetadata>;
}

export interface ChunkedDocumentOutput {
  documentId: string;
  sourceName: string;
  projectId: string;
  contentType: KnowledgeContentType;
  charCount: number;
  chunks: PreparedChunk[];
}

function isMostlyPrintableText(text: string): boolean {
  if (text.includes('\u0000')) {
    return false;
  }

  let controlCount = 0;
  const sampleLength = Math.min(text.length, 4096);
  for (let i = 0; i < sampleLength; i += 1) {
    const code = text.charCodeAt(i);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    if (code < 32 && !isAllowedControl) {
      controlCount += 1;
    }
  }

  return sampleLength === 0 || controlCount / sampleLength <= 0.1;
}

function flattenJsonToText(value: unknown, prefix = ''): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const line = prefix ? `${prefix}: ${String(value)}` : String(value);
    return [line];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJsonToText(item, prefix ? `${prefix}[${index}]` : `[${index}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenJsonToText(nested, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

export function extractDocumentText(rawContent: string, contentType: KnowledgeContentType = 'text/plain'): string {
  if (typeof rawContent !== 'string') {
    throw new RagValidationError('Document content must be a string.');
  }

  if (!isMostlyPrintableText(rawContent)) {
    throw new RagValidationError('Malformed or binary document content is not supported.');
  }

  let extracted = rawContent;

  if (contentType === 'application/json') {
    try {
      const parsed = JSON.parse(rawContent) as unknown;
      const lines = flattenJsonToText(parsed);
      extracted = lines.join('\n');
    } catch {
      throw new RagValidationError('Malformed JSON document: unable to parse.');
    }
  } else if (contentType === 'text/html') {
    extracted = rawContent
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
  }

  const normalized = extracted
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    throw new RagValidationError('Document content is empty after text extraction.');
  }

  return normalized;
}

const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

function recursiveSplit(text: string, chunkSize: number, separators: string[]): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const separator = separators.find((sep) => (sep === '' ? true : text.includes(sep))) ?? '';
  const remainingSeparators = separators.slice(separators.indexOf(separator) + 1);

  const rawParts = separator === '' ? Array.from(text) : text.split(separator);
  const chunks: string[] = [];
  let current = '';

  for (const part of rawParts) {
    const candidate = current
      ? separator === '. '
        ? `${current}. ${part}`
        : `${current}${separator}${part}`
      : part;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
      current = '';
    }

    if (part.length > chunkSize) {
      if (remainingSeparators.length > 0) {
        chunks.push(...recursiveSplit(part, chunkSize, remainingSeparators));
      } else {
        for (let i = 0; i < part.length; i += chunkSize) {
          chunks.push(part.slice(i, i + chunkSize).trim());
        }
      }
    } else {
      current = part;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

export function splitTextWithOverlap(
  text: string,
  chunkSize = config.ragChunkSize,
  chunkOverlap = config.ragChunkOverlap,
): string[] {
  const safeSize = Math.max(80, chunkSize);
  const safeOverlap = Math.max(0, Math.min(chunkOverlap, Math.floor(safeSize / 2)));

  const baseChunks = recursiveSplit(text, safeSize, SEPARATORS);
  if (baseChunks.length <= 1 || safeOverlap === 0) {
    return baseChunks;
  }

  const overlapped: string[] = [baseChunks[0]];
  for (let i = 1; i < baseChunks.length; i += 1) {
    const prev = baseChunks[i - 1];
    const curr = baseChunks[i];
    const overlapPrefix = prev.slice(Math.max(0, prev.length - safeOverlap)).trim();
    if (overlapPrefix && !curr.startsWith(overlapPrefix) && overlapPrefix.length + curr.length + 1 <= safeSize + safeOverlap) {
      overlapped.push(`${overlapPrefix}\n${curr}`.trim());
    } else {
      overlapped.push(curr);
    }
  }

  return overlapped;
}

function detectSectionAndPage(
  fullText: string,
  chunkText: string,
  searchStartIndex: number,
  fallbackSection?: string,
  fallbackPage?: number,
): { section?: string; page?: number; nextSearchIndex: number } {
  const probe = chunkText.slice(0, Math.min(chunkText.length, 60));
  const foundAt = fullText.indexOf(probe, Math.max(0, searchStartIndex));
  const offset = foundAt >= 0 ? foundAt : searchStartIndex;
  const prefixText = fullText.slice(0, offset + chunkText.length);

  let section = fallbackSection;
  const headingMatches = [...prefixText.matchAll(/^#{1,4}\s+(.+)$/gm)];
  if (headingMatches.length > 0) {
    section = headingMatches[headingMatches.length - 1][1].trim();
  }

  let page = fallbackPage;
  const pageMatches = [...prefixText.matchAll(/(?:\[page\s+(\d+)\]|---\s*page\s+(\d+)\s*---)/gi)];
  if (pageMatches.length > 0) {
    const lastMatch = pageMatches[pageMatches.length - 1];
    const parsedPage = Number(lastMatch[1] ?? lastMatch[2]);
    if (Number.isFinite(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  return {
    section,
    page,
    nextSearchIndex: foundAt >= 0 ? foundAt + Math.max(1, Math.floor(chunkText.length / 2)) : searchStartIndex,
  };
}

export function createKnowledgeChunks(input: ChunkDocumentInput): ChunkedDocumentOutput {
  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!userId) {
    throw new RagValidationError('Authenticated userId is required for knowledge ingestion.');
  }

  const sourceName = typeof input.sourceName === 'string' ? input.sourceName.trim() : '';
  if (!sourceName) {
    throw new RagValidationError('sourceName is required for knowledge ingestion.');
  }

  const contentType: KnowledgeContentType = input.contentType ?? 'text/plain';
  const extractedText = extractDocumentText(input.content, contentType);
  const projectId = (input.projectId ?? 'default').trim() || 'default';
  const documentId =
    input.documentId?.trim() || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();

  const textChunks = splitTextWithOverlap(extractedText, input.chunkSize, input.chunkOverlap);
  if (textChunks.length === 0) {
    throw new RagValidationError('Document produced zero text chunks after splitting.');
  }

  let searchCursor = 0;
  const chunks: PreparedChunk[] = textChunks.map((content, index) => {
    const detected = detectSectionAndPage(
      extractedText,
      content,
      searchCursor,
      input.section,
      input.page,
    );
    searchCursor = detected.nextSearchIndex;

    const metadata: KnowledgeChunkMetadata = {
      documentId,
      sourceName,
      chunkId: `${documentId}-chunk-${index}`,
      chunkIndex: index,
      totalChunks: textChunks.length,
      userId,
      projectId,
      ...(input.investigationId ? { investigationId: input.investigationId.trim() } : {}),
      ...(detected.section ? { section: detected.section } : {}),
      ...(detected.page !== undefined ? { page: detected.page } : {}),
      createdAt,
    };

    return {
      content,
      metadata,
      document: new Document<KnowledgeChunkMetadata>({
        pageContent: content,
        metadata,
      }),
    };
  });

  return {
    documentId,
    sourceName,
    projectId,
    contentType,
    charCount: extractedText.length,
    chunks,
  };
}

