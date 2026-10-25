import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { LlmContentPart } from '../llm/llm.types';

export type StoredFileKind = 'pdf' | 'image' | 'text';

export interface PreparedFile {
  name: string;
  mime: string;
  kind: StoredFileKind;
  /** base64 for pdf/image, plain text for text. */
  data: string;
}

const MAX_TEXT_CHARS = 200_000;
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Normalises an upload into something a model can read: PDFs and images natively, everything else as text. */
export function prepareFile(file: { originalname: string; buffer: Buffer; mimetype?: string }): PreparedFile {
  const name = file.originalname;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') {
    return { name, mime: 'application/pdf', kind: 'pdf', data: file.buffer.toString('base64') };
  }
  if (IMAGE_MIME[ext]) {
    return { name, mime: IMAGE_MIME[ext], kind: 'image', data: file.buffer.toString('base64') };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const text = wb.SheetNames.map((sheet) => `# Sheet: ${sheet}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheet])}`).join('\n\n');
    return { name, mime: 'text/csv', kind: 'text', data: text.slice(0, MAX_TEXT_CHARS) };
  }
  if (['csv', 'tsv', 'txt', 'ofx', 'qif'].includes(ext)) {
    return { name, mime: 'text/plain', kind: 'text', data: file.buffer.toString('utf8').slice(0, MAX_TEXT_CHARS) };
  }
  throw new BadRequestException(`Unsupported file "${name}". Use PDF, image, CSV, XLSX or OFX.`);
}

export function toContentPart(file: PreparedFile): LlmContentPart {
  if (file.kind === 'pdf') {
    return { type: 'file', file: { filename: file.name, file_data: `data:application/pdf;base64,${file.data}` } };
  }
  if (file.kind === 'image') {
    return { type: 'image_url', image_url: { url: `data:${file.mime};base64,${file.data}` } };
  }
  return { type: 'text', text: `<document name="${file.name}">\n${file.data}\n</document>` };
}
