import { Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export interface ParsedTransaction {
  date: string;
  amount: string;
  type: 'income' | 'expense';
  description: string;
}

export interface ParseResult {
  bank: 'nubank' | 'itau' | 'bradesco' | 'generic';
  transactions: ParsedTransaction[];
}

@Injectable()
export class BankParserService {
  parse(buffer: Buffer, fileName: string): ParseResult {
    const ext = fileName.split('.').pop()?.toLowerCase();
    let rows: Record<string, string>[];

    if (ext === 'csv') {
      rows = parseCsv(buffer, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      throw new Error('Unsupported file format. Use CSV or XLSX.');
    }

    if (rows.length === 0) return { bank: 'generic', transactions: [] };

    const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

    if (this.detectNubank(headers)) {
      return { bank: 'nubank', transactions: this.parseNubank(rows) };
    }
    if (this.detectItau(headers)) {
      return { bank: 'itau', transactions: this.parseItau(rows) };
    }
    if (this.detectBradesco(headers)) {
      return { bank: 'bradesco', transactions: this.parseBradesco(rows) };
    }
    return { bank: 'generic', transactions: this.parseGeneric(rows) };
  }

  private detectNubank(h: string[]): boolean {
    return (h.includes('data') && h.includes('valor') && h.includes('descricao')) ||
      (h.includes('date') && h.includes('title') && h.includes('amount'));
  }

  private detectItau(h: string[]): boolean {
    return h.includes('data') && h.includes('lancamento') && h.includes('valor');
  }

  private detectBradesco(h: string[]): boolean {
    return h.includes('data') && h.includes('historico') && (h.includes('credito') || h.includes('debito'));
  }

  private parseNubank(rows: Record<string, string>[]): ParsedTransaction[] {
    const first = rows[0];
    if ('title' in first || 'Title' in first) {
      return rows.map((r) => {
        const amount = this.parseBRNumber(r['amount'] ?? r['Amount'] ?? '0');
        return {
          date: this.parseDateBR(r['date'] ?? r['Date']),
          amount: Math.abs(amount).toFixed(2),
          type: 'expense' as const,
          description: r['title'] ?? r['Title'] ?? '',
        };
      }).filter((t) => Number(t.amount) > 0 && t.description);
    }
    return rows.map((r) => {
      const amount = this.parseBRNumber(r['Valor'] ?? r['valor'] ?? '0');
      return {
        date: this.parseDateBR(r['Data'] ?? r['data']),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r['Descricao'] ?? r['descricao'] ?? r['Descrição'] ?? r['descrição'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseItau(rows: Record<string, string>[]): ParsedTransaction[] {
    return rows.map((r) => {
      const raw = r['Valor'] ?? r['valor'] ?? r['VALOR'] ?? '0';
      const amount = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
      return {
        date: this.parseDateBR(r['Data'] ?? r['data'] ?? r['DATA']),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r['Lançamento'] ?? r['Lancamento'] ?? r['lancamento'] ?? r['LANCAMENTO'] ?? r['Descrição'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseBradesco(rows: Record<string, string>[]): ParsedTransaction[] {
    return rows.map((r) => {
      const credit = this.parseBRNumber(r['Crédito'] ?? r['Credito'] ?? r['credito'] ?? '0');
      const debit = this.parseBRNumber(r['Débito'] ?? r['Debito'] ?? r['debito'] ?? '0');
      const amount = credit > 0 ? credit : debit;
      const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense';
      return {
        date: this.parseDateBR(r['Data'] ?? r['data']),
        amount: Math.abs(amount).toFixed(2),
        type,
        description: r['Histórico'] ?? r['Historico'] ?? r['historico'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseGeneric(rows: Record<string, string>[]): ParsedTransaction[] {
    const keys = Object.keys(rows[0] ?? {});
    const dateKey = keys.find((k) => /date|data/i.test(k));
    const amountKey = keys.find((k) => /amount|valor|value/i.test(k));
    const descKey = keys.find((k) => /desc|title|name|hist/i.test(k));
    if (!dateKey || !amountKey || !descKey) return [];
    return rows.map((r) => {
      const raw = r[amountKey] ?? '0';
      const amount = this.parseBRNumber(raw);
      return {
        date: this.parseDateBR(r[dateKey]),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r[descKey] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseBRNumber(str: string): number {
    if (!str) return 0;
    const stripped = str.replace(/[R$\s]/g, '');
    // BR format uses . as thousands sep and , as decimal sep (e.g. "1.500,00")
    // Standard format uses . as decimal sep (e.g. "-150.00")
    if (stripped.includes(',')) {
      return parseFloat(stripped.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(stripped) || 0;
  }

  private parseDateBR(str: string): string {
    if (!str) return new Date().toISOString().slice(0, 10);
    const parts = str.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const fullYear = year.length === 2 ? '20' + year : year;
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const iso = new Date(str);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }
}
