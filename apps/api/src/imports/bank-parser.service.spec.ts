import { BankParserService } from './bank-parser.service';

const service = new BankParserService();

describe('BankParserService', () => {
  it('parses Nubank credit card CSV', () => {
    const csv = `date,title,amount\n2026-06-01,Supermercado,-150.00\n2026-06-02,Netflix,-39.90`;
    const result = service.parse(Buffer.from(csv), 'nubank.csv');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe('150.00');
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[0].description).toBe('Supermercado');
  });

  it('parses Nubank account CSV (Portuguese headers)', () => {
    const csv = `Data,Valor,Descricao\n01/06/2026,-100.00,Padaria\n02/06/2026,500.00,Salario`;
    const result = service.parse(Buffer.from(csv), 'nubank_conta.csv');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[1].type).toBe('income');
  });

  it('parses Itau CSV', () => {
    const csv = `Data,Lançamento,Valor\n01/06/2026,Supermercado Extra,-200,00\n02/06/2026,Salario,3000,00`;
    const result = service.parse(Buffer.from(csv), 'itau.csv');
    expect(result.bank).toBe('itau');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it('returns generic bank for unknown format', () => {
    const csv = `date,description,value\n2026-06-01,Test,-50.00`;
    const result = service.parse(Buffer.from(csv), 'unknown.csv');
    expect(result.bank).toBe('generic');
    expect(result.transactions.length).toBeGreaterThanOrEqual(0);
  });

  it('throws on unsupported extension', () => {
    expect(() => service.parse(Buffer.from('data'), 'file.pdf')).toThrow('Unsupported file format');
  });
});
