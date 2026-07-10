import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfirmImportDto } from './confirm-import.dto';

describe('ConfirmImportDto', () => {
  it('accepts numeric amounts in confirmed import transactions', () => {
    const dto = plainToInstance(ConfirmImportDto, {
      transactions: [
        {
          date: '2026-06-01T15:00:00.000Z',
          amount: 126,
          type: 'income',
          description: 'Resgate RDB',
        },
      ],
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.transactions[0].amount).toBe('126.00');
  });
});
