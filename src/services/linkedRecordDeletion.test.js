import { describe, expect, it } from 'vitest';
import {
  buildInvestmentDeletionPlan,
  buildTransactionDeletionPlan,
} from './linkedRecordDeletion';

describe('buildTransactionDeletionPlan', () => {
  it('keeps linked investment and clears its backlink when deleting a single transaction', () => {
    const transaction = { id: 'tx-1', investmentId: 'inv-1' };
    const linkedInvestment = { id: 'inv-1', transactionId: 'tx-1' };

    const plan = buildTransactionDeletionPlan({
      transaction,
      linkedInvestment,
      deleteScope: 'single',
      deleteLinkedInvestment: false,
    });

    expect(plan.transactionIdsToDelete).toEqual(['tx-1']);
    expect(plan.investmentIdsToDelete).toEqual([]);
    expect(plan.investmentIdsToUnlink).toEqual(['inv-1']);
  });

  it('deletes all installment transactions and linked investment when requested', () => {
    const transaction = { id: 'tx-1', investmentId: 'inv-1' };
    const linkedInvestment = { id: 'inv-1', transactionId: 'tx-1' };
    const installmentTransactions = [{ id: 'tx-1' }, { id: 'tx-2' }, { id: 'tx-3' }];

    const plan = buildTransactionDeletionPlan({
      transaction,
      linkedInvestment,
      installmentTransactions,
      deleteScope: 'group',
      deleteLinkedInvestment: true,
    });

    expect(plan.transactionIdsToDelete).toEqual(['tx-1', 'tx-2', 'tx-3']);
    expect(plan.investmentIdsToDelete).toEqual(['inv-1']);
    expect(plan.investmentIdsToUnlink).toEqual([]);
  });
});

describe('buildInvestmentDeletionPlan', () => {
  it('keeps linked transactions and clears their investment link when deleting only the investment', () => {
    const investment = { id: 'inv-1', transactionId: 'tx-1' };
    const linkedTransactions = [{ id: 'tx-1' }, { id: 'tx-2' }];

    const plan = buildInvestmentDeletionPlan({
      investment,
      linkedTransactions,
      deleteLinkedTransactions: false,
    });

    expect(plan.investmentIdsToDelete).toEqual(['inv-1']);
    expect(plan.transactionIdsToDelete).toEqual([]);
    expect(plan.transactionIdsToUnlink).toEqual(['tx-1', 'tx-2']);
  });

  it('deletes linked transactions together with the investment when requested', () => {
    const investment = { id: 'inv-1', transactionId: 'tx-1' };
    const linkedTransactions = [{ id: 'tx-1' }];

    const plan = buildInvestmentDeletionPlan({
      investment,
      linkedTransactions,
      deleteLinkedTransactions: true,
    });

    expect(plan.investmentIdsToDelete).toEqual(['inv-1']);
    expect(plan.transactionIdsToDelete).toEqual(['tx-1']);
    expect(plan.transactionIdsToUnlink).toEqual([]);
  });
});
