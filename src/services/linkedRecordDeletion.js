import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

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
  const snapshot = await getDoc(doc(db, 'transactions', transactionId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getInvestmentById(investmentId) {
  if (!investmentId) return null;
  const snapshot = await getDoc(doc(db, 'investments', investmentId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getInstallmentTransactions(transaction) {
  if (!transaction?.isInstallment || !transaction?.installmentGroupId || !transaction?.userId) {
    return transaction?.id ? [transaction] : [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'transactions'),
      where('installmentGroupId', '==', transaction.installmentGroupId),
      where('userId', '==', transaction.userId)
    )
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function findLinkedInvestmentForTransaction(transaction) {
  if (transaction?.investmentId) {
    const investment = await getInvestmentById(transaction.investmentId);
    if (investment) return investment;
  }

  if (!transaction?.id) return null;

  const snapshot = await getDocs(
    query(collection(db, 'investments'), where('transactionId', '==', transaction.id), limit(1))
  );

  if (snapshot.empty) return null;
  const match = snapshot.docs[0];
  return { id: match.id, ...match.data() };
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
    const snapshot = await getDocs(
      query(collection(db, 'transactions'), where('investmentId', '==', investment.id))
    );
    snapshot.docs.forEach((item) => pushUnique({ id: item.id, ...item.data() }));
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

  const batch = writeBatch(db);

  plan.transactionIdsToDelete.forEach((transactionId) => {
    batch.delete(doc(db, 'transactions', transactionId));
  });

  plan.investmentIdsToDelete.forEach((investmentId) => {
    batch.delete(doc(db, 'investments', investmentId));
  });

  plan.investmentIdsToUnlink.forEach((investmentId) => {
    batch.update(doc(db, 'investments', investmentId), {
      transactionId: deleteField(),
    });
  });

  await batch.commit();

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

  const batch = writeBatch(db);

  plan.transactionIdsToDelete.forEach((transactionId) => {
    batch.delete(doc(db, 'transactions', transactionId));
  });

  plan.transactionIdsToUnlink.forEach((transactionId) => {
    batch.update(doc(db, 'transactions', transactionId), {
      investmentId: deleteField(),
    });
  });

  plan.investmentIdsToDelete.forEach((investmentId) => {
    batch.delete(doc(db, 'investments', investmentId));
  });

  await batch.commit();

  return {
    deletedTransactionCount: plan.transactionIdsToDelete.length,
    deletedInvestmentCount: plan.investmentIdsToDelete.length,
  };
}
