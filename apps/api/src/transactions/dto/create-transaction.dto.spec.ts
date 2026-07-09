import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

describe('CreateTransactionDto', () => {
  it('accepts numeric amounts from imported transactions', () => {
    const dto = plainToInstance(CreateTransactionDto, {
      amount: 126,
      type: 'income',
      date: '2026-06-01T15:00:00.000Z',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.amount).toBe('126.00');
  });
});
