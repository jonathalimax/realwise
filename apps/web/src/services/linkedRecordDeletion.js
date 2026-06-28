import { transactionsResource } from '../lib/api/resources/transactions';
import { investmentsResource } from '../lib/api/resources/investments';

const uniqueIds = (items = []) => [...new Set(items.filter(Boolean))];

export function buildTransactionDeletionPlan({
  transaction,
  linkedInvestment,
  installmentTransactions = [],
  deleteScope = 'single',
  deleteLinkedInvestment = false,
}) {
  const transactionIdsToDelete = uniqueIds(
    deleteScope === 'group'
      ? installmentTransactions.map((item) => item.id)
      : [transaction?.id]
  );

  return {
    transactionIdsToDelete,
    investmentIdsToDelete: deleteLinkedInvestment && linkedInvestment?.id ? [linkedInvestment.id] : [],
    investmentIdsToUnlink:
      !deleteLinkedInvestment && linkedInvestment?.id ? [linkedInvestment.id] : [],
  };
}

export function buildInvestmentDeletionPlan({
  investment,
  linkedTransactions = [],
  deleteLinkedTransactions = false,
}) {
  const transactionIds = uniqueIds(linkedTransactions.map((item) => item.id));

  return {
    investmentIdsToDelete: investment?.id ? [investment.id] : [],
    transactionIdsToDelete: deleteLinkedTransactions ? transactionIds : [],
    transactionIdsToUnlink: deleteLinkedTransactions ? [] : transactionIds,
  };
}

async function getTransactionById(transactionId) {
  if (!transactionId) return null;
  try {
    return await transactionsResource.get(transactionId);
  } catch {
    return null;
  }
}

async function getInvestmentById(investmentId) {
  if (!investmentId) return null;
  try {
    return await investmentsResource.get(investmentId);
  } catch {
    return null;
  }
}

async function getInstallmentTransactions(transaction) {
  if (!transaction?.isInstallment || !transaction?.installmentGroupId || !transaction?.userId) {
    return transaction?.id ? [transaction] : [];
  }

  const rows = await transactionsResource.list();
  return rows.filter(
    (item) =>
      item.installmentGroupId === transaction.installmentGroupId
      && item.userId === transaction.userId
  );
}

async function findLinkedInvestmentForTransaction(transaction) {
  if (transaction?.investmentId) {
    const investment = await getInvestmentById(transaction.investmentId);
    if (investment) return investment;
  }

  if (!transaction?.id) return null;
  const rows = await investmentsResource.list();
  return rows.find((item) => item.transactionId === transaction.id) || null;
}

async function findLinkedTransactionsForInvestment(investment) {
  const matches = [];
  const seen = new Set();

  const pushUnique = (item) => {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    matches.push(item);
  };

  if (investment?.transactionId) {
    pushUnique(await getTransactionById(investment.transactionId));
  }

  if (investment?.id) {
    const rows = await transactionsResource.list();
    rows
      .filter((item) => item.investmentId === investment.id)
      .forEach((item) => pushUnique(item));
  }

  return matches;
}

export async function deleteTransactionWithLinks({
  transaction,
  deleteScope = 'single',
  deleteLinkedInvestment = false,
}) {
  const linkedInvestment = await findLinkedInvestmentForTransaction(transaction);
  const installmentTransactions =
    deleteScope === 'group' ? await getInstallmentTransactions(transaction) : [transaction];

  const plan = buildTransactionDeletionPlan({
    transaction,
    linkedInvestment,
    installmentTransactions,
    deleteScope,
    deleteLinkedInvestment,
  });

  await Promise.all(plan.transactionIdsToDelete.map((transactionId) => transactionsResource.remove(transactionId)));
  await Promise.all(plan.investmentIdsToDelete.map((investmentId) => investmentsResource.remove(investmentId)));
  await Promise.all(plan.investmentIdsToUnlink.map((investmentId) => (
    investmentsResource.update(investmentId, { transactionId: null })
  )));

  return {
    deletedTransactionCount: plan.transactionIdsToDelete.length,
    deletedInvestmentCount: plan.investmentIdsToDelete.length,
  };
}

export async function deleteInvestmentWithLinks({
  investment,
  deleteLinkedTransactions = false,
}) {
  const linkedTransactions = await findLinkedTransactionsForInvestment(investment);
  const plan = buildInvestmentDeletionPlan({
    investment,
    linkedTransactions,
    deleteLinkedTransactions,
  });

  await Promise.all(plan.transactionIdsToDelete.map((transactionId) => transactionsResource.remove(transactionId)));
  await Promise.all(
    plan.transactionIdsToUnlink.map((transactionId) =>
      transactionsResource.update(transactionId, { investmentId: null })
    )
  );

  await Promise.all(plan.investmentIdsToDelete.map((investmentId) => investmentsResource.remove(investmentId)));

  return {
    deletedTransactionCount: plan.transactionIdsToDelete.length,
    deletedInvestmentCount: plan.investmentIdsToDelete.length,
  };
}
