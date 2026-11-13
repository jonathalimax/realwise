import { useState, useEffect, useRef } from 'react';
import { useSettings, UNCATEGORIZED_CATEGORY } from '../contexts/SettingsContext';
import { useGoals } from '../contexts/GoalsContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useAccess } from '../contexts/AccessContext';
import { requireOwnerId } from '../lib/auth/ownerSession';
import { transactionsResource } from '../lib/api/resources/transactions';
import { buildUpdatedMetadata } from '../utils/transactionMetadata';
import { deleteTransactionWithLinks } from '../services/linkedRecordDeletion';
import CurrencyInput from './ui/CurrencyInput';
import PercentInput from './ui/PercentInput';
import usePlannerGoals from '../pages/planner/usePlannerGoals';
import DateInput from '@/components/ui/DateInput';
import BottomSheet from './chat/BottomSheet';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Payment methods that make sense for each kind of entry (the API accepts these values).
const METHOD_LABEL = {
  credit: { pt: 'Crédito', en: 'Credit' },
  debit: { pt: 'Débito', en: 'Debit' },
  pix: { pt: 'PIX', en: 'PIX' },
  transfer: { pt: 'Transferência', en: 'Transfer' },
  boleto: { pt: 'Boleto', en: 'Boleto' },
  cash: { pt: 'Dinheiro', en: 'Cash' },
  other: { pt: 'Outro', en: 'Other' },
};
const methodsFor = (type, transfer) => (transfer ? ['pix', 'transfer', 'other'] : type === 'income' ? ['pix', 'transfer', 'cash', 'other'] : ['credit', 'debit', 'pix', 'boleto', 'transfer', 'cash']);

const isInvestmentName = (c) => c === 'Investments' || c === 'Investimentos';

const FIELD = 'w-full min-h-[48px] px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-base text-[var(--rw-ink)] placeholder-gray-400 focus:border-[var(--rw-brand)] focus:ring-0 focus:outline-none transition-colors';
const SELECT = `${FIELD} appearance-none cursor-pointer pr-10 truncate`;
const SELECT_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '20px',
};

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--rw-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ checked, onChange, disabled, title, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex w-full min-h-[56px] items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${
        checked ? 'border-[var(--rw-brand)] bg-[var(--rw-brand-soft)]' : 'border-[var(--rw-border)]'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--rw-ink)]">{title}</span>
        {hint && <span className="block text-xs text-[var(--rw-muted)]">{hint}</span>}
      </span>
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full px-1.5 transition-colors ${checked ? 'bg-[var(--rw-brand)]' : 'bg-[var(--rw-track)]'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

/** One radio row of a scope choice ("Só esta parcela", ...). */
function RadioRow({ checked, onSelect, title, danger }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full min-h-[56px] items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        checked ? (danger ? 'border-red-500 bg-red-500/10' : 'border-[var(--rw-brand)] bg-[var(--rw-brand-soft)]') : 'border-[var(--rw-border)]'
      }`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? (danger ? 'border-red-500' : 'border-[var(--rw-brand)]') : 'border-[var(--rw-muted)]'}`}>
        {checked && <span className={`h-2.5 w-2.5 rounded-full ${danger ? 'bg-red-500' : 'bg-[var(--rw-brand)]'}`} />}
      </span>
      <span className="min-w-0 text-sm font-semibold text-[var(--rw-ink)]">{title}</span>
    </button>
  );
}

export default function EditSingleTransactionModal({ isOpen, onClose, transaction, onSuccess, onSaveDraft = null }) {
  const { ownerId, canWrite } = useAccess();
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedPlannerGoalId, setSelectedPlannerGoalId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [isIgnored, setIsIgnored] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [isTransfer, setIsTransfer] = useState(false); // money moving between the user's own accounts
  const [loading, setLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // One confirmation sheet for both "save to which installments" and "delete which installments".
  const [confirm, setConfirm] = useState(null); // null | 'save' | 'delete'
  const [scope, setScope] = useState('single'); // 'single' | 'following' | 'group'
  const [deleteLinkedInvestment, setDeleteLinkedInvestment] = useState(false);
  const [investmentType, setInvestmentType] = useState('fixed_income');

  // Investment-specific fields
  const [expectedReturn, setExpectedReturn] = useState(0);
  const [maturityDate, setMaturityDate] = useState('');
  const [ticker, setTicker] = useState('');
  const [platform, setPlatform] = useState('');
  const [coinName, setCoinName] = useState('');
  const [fundName, setFundName] = useState('');

  const { categories, t, language } = useSettings();
  const pt = language === 'pt';
  const { goals } = useGoals();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank } = useCards();
  const { addInvestment, updateInvestment, investments } = useInvestments();

  // Latest context values for the populate effect, which must run only when the transaction changes
  // (CardsContext recreates findUserBank on every render and would otherwise wipe what the person is typing).
  const findUserBankRef = useRef(findUserBank);
  const investmentsRef = useRef(investments);
  useEffect(() => {
    findUserBankRef.current = findUserBank;
    investmentsRef.current = investments;
  });

  const availableGoals = goals.filter(g => !g.completed);
  const plannerGoals = usePlannerGoals();
  const isDraftMode = Boolean(onSaveDraft);
  const linkedInvestment = transaction?.investmentId
    ? investments.find((item) => item.id === transaction.investmentId) ?? null
    : investments.find((item) => item.transactionId === transaction?.id) ?? null;
  const hasLinkedInvestment = Boolean(transaction?.investmentId || linkedInvestment);
  const isInstallmentTransaction = Boolean(transaction?.isInstallment && transaction?.installmentGroupId);
  const showInvestmentFields = !isTransfer && isInvestmentName(category);
  const showPlannerGoal = !isTransfer && type === 'expense' && isInvestmentName(category);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');
      setAmount(transaction.amount || 0);
      // Both "no category" spellings mean the same thing: show the one from the current language so the select can match it.
      const uncatNames = Object.values(UNCATEGORIZED_CATEGORY);
      setCategory(!transaction.category || uncatNames.includes(transaction.category)
        ? (UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt)
        : transaction.category);
      setTransactionDate(transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setSelectedGoalId(transaction.goalId || '');
      setSelectedPlannerGoalId(transaction.plannerGoalId || '');
      // Handle both old (bank type) and new (document ID) formats
      // Convert old format to new format by finding the user bank
      const storedAccount = transaction.accountId || transaction.bankId;
      const userBank = storedAccount ? findUserBankRef.current(storedAccount) : null;
      setSelectedBankId(userBank ? userBank.id : null);
      setIsIgnored(transaction.ignored || false);
      setIsTransfer(Boolean(transaction.isTransfer));
      setPaymentMethod(transaction.paymentMethod || (userBank ? (userBank.hasCredit ? 'credit' : 'debit') : 'cash'));
      setScope('single');
      setConfirm(null);
      setDeleteLinkedInvestment(false);
      setInvestmentType(transaction.investmentType || 'fixed_income');
      // Open the extra options straight away when something in them is already set.
      setMoreOpen(Boolean(transaction.notes || transaction.ignored || transaction.isTransfer || transaction.goalId || transaction.plannerGoalId));

      // Load investment data if transaction is linked to an investment
      if (transaction.investmentId) {
        const linked = investmentsRef.current.find(inv => inv.id === transaction.investmentId);
        if (linked) {
          setExpectedReturn((linked.expectedReturn || 0) * 100); // Convert to percentage
          setMaturityDate(linked.maturityDate || '');
          setTicker(linked.ticker || '');
          setPlatform(linked.platform || '');
          setCoinName(linked.coinName || '');
          setFundName(linked.fundName || '');
        }
      } else {
        // Reset investment fields
        setExpectedReturn(0);
        setMaturityDate('');
        setTicker('');
        setPlatform('');
        setCoinName('');
        setFundName('');
      }
    }
  }, [transaction, linkedInvestment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cards can finish loading after the sheet opened: resolve the account then, but never over a choice the person made.
  useEffect(() => {
    if (!transaction || selectedBankId) return;
    const stored = transaction.accountId || transaction.bankId;
    const found = stored ? findUserBank(stored) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setSelectedBankId(found.id);
  }, [userBanks]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Keep a payment method that is valid for the (new) kind of entry; otherwise fall back to the first valid one. */
  const validMethod = (current, nextType, nextTransfer) => {
    const list = methodsFor(nextType, nextTransfer);
    return list.includes(current) ? current : list[0];
  };

  const changeType = (next) => {
    if (next === type) return;
    setType(next);
    // The category list is different for income and expense: keep the category only if it exists on the other side.
    const uncat = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
    const list = categories[next] || [];
    if (!list.includes(category)) setCategory(list.includes(uncat) ? uncat : '');
    if (next === 'income') setSelectedPlannerGoalId('');
    setPaymentMethod((prev) => validMethod(prev, next, isTransfer));
  };

  const toggleTransfer = (next) => {
    setIsTransfer(next);
    if (next) {
      setCategory('');
      setIsIgnored(true); // out of the income/expense totals
      setSelectedGoalId('');
      setSelectedPlannerGoalId('');
      setPaymentMethod((prev) => validMethod(prev, type, true));
    } else {
      setIsIgnored(false);
      const uncat = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
      setCategory((categories[type] || []).includes(uncat) ? uncat : '');
      setPaymentMethod((prev) => validMethod(prev, type, false));
    }
  };

  const changeBank = (value) => {
    const newBankId = value === 'cash' ? null : value;
    setSelectedBankId(newBankId);
    if (newBankId) {
      const bank = findUserBank(newBankId);
      const preferred = type === 'income' || isTransfer ? 'pix' : bank?.hasCredit ? 'credit' : 'debit';
      setPaymentMethod((prev) => (methodsFor(type, isTransfer).includes(prev) && prev !== 'cash' ? prev : preferred));
    } else {
      setPaymentMethod('cash');
    }
  };

  const handleDelete = async () => {
    if (!transaction?.id || !canWrite) return;

    setLoading(true);
    try {
      await deleteTransactionWithLinks({
        transaction,
        deleteScope: isInstallmentTransaction ? scope : 'single',
        deleteLinkedInvestment,
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert(pt ? 'Falha ao excluir a transação. Tente novamente.' : 'Failed to delete transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /** `appliedScope` is the choice from the confirmation sheet for installments ('single' | 'following' | 'group'). */
  const submit = async (appliedScope = 'single') => {
    if (!amount || amount <= 0 || !transaction || !canWrite) return;
    setConfirm(null);
    setLoading(true);

    try {
      const userId = transaction.userId || requireOwnerId(ownerId);

      const baseDate = new Date(transactionDate + 'T12:00:00');
      const selectedGoal = selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null;

      const finalCategory = isTransfer ? null : category; // a transfer has no category; otherwise as chosen (may be empty)

      const isInvestmentCategory = !isTransfer && isInvestmentName(finalCategory);

      const updatedMetadata = buildUpdatedMetadata(transaction.metadata, finalCategory, transaction.category);

      const buildInvestmentExtraFields = () => {
        switch (investmentType) {
          case 'fixed_income':
            return {
              expectedReturn: parseFloat(expectedReturn) / 100 || 0,
              maturityDate: maturityDate || null,
            };
          case 'stocks':
            return { ticker: ticker || '', platform: platform || '' };
          case 'crypto':
            return { coinName: coinName || '', platform: platform || '' };
          case 'funds':
            return { fundName: fundName || '', platform: platform || '' };
          case 'fii':
            return { ticker: ticker || '', platform: platform || '' };
          default:
            return {};
        }
      };

      const updates = {
        userId,
        type,
        description: description.trim(),
        // An emptied description clears the notes (null), never leaves the old text behind.
        notes: notes.trim() || null,
        amount: parseFloat(amount),
        category: finalCategory,
        date: baseDate.toISOString(),
        goalId: isTransfer ? null : selectedGoalId || null,
        goalName: isTransfer ? null : selectedGoal?.name || null,
        plannerGoalId: isTransfer ? null : selectedPlannerGoalId || null,
        // The account is stored in both fields: accountId is what the chat and transfers use, bankId the legacy one.
        accountId: selectedBankId && UUID_RE.test(selectedBankId) ? selectedBankId : null,
        bankId: selectedBankId || null,
        paymentMethod: selectedBankId || isTransfer ? paymentMethod : 'cash',
        ignored: isTransfer ? true : isIgnored,
        isTransfer,
        // Investment type (if category is Investments)
        investmentType: isInvestmentCategory ? investmentType : null,
        metadata: updatedMetadata
      };

      if (isDraftMode) {
        const extraFields = isInvestmentName(category) ? buildInvestmentExtraFields() : {};

        onSaveDraft?.({
          ...transaction,
          ...updates,
          ticker: extraFields.ticker ?? ticker ?? null,
          platform: extraFields.platform ?? platform ?? null,
          coinName: extraFields.coinName ?? coinName ?? null,
          fundName: extraFields.fundName ?? fundName ?? null,
          expectedReturn: extraFields.expectedReturn ?? (expectedReturn ? parseFloat(expectedReturn) : null),
          maturityDate: extraFields.maturityDate ?? (maturityDate || null),
        });
        onClose();
        return;
      }

      // Handle investment record creation/update if category is Investments
      if (isInvestmentCategory) {
        const extraFields = buildInvestmentExtraFields();
        const investmentData = {
          name: description,
          type: investmentType,
          bank: selectedBankId || '',
          initialAmount: parseFloat(amount),
          currentAmount: parseFloat(amount),
          expectedReturn: extraFields.expectedReturn ?? (parseFloat(expectedReturn) / 100 || 0),
          purchaseDate: transactionDate,
          maturityDate: extraFields.maturityDate ?? (maturityDate || null),
          goalId: selectedGoalId || null,
          notes: '',
          ...extraFields,
        };

        if (transaction.investmentId) {
          // Update existing investment
          await updateInvestment(transaction.investmentId, investmentData);
        } else {
          // Create new investment and link it to the transaction
          const newInvestmentId = await addInvestment(investmentData, false); // false = don't create transaction
          if (newInvestmentId) {
            updates.investmentId = newInvestmentId;
          }
        }
      }

      if (isInstallmentTransaction && appliedScope !== 'single') {
        const rows = await transactionsResource.list();
        const baseDescription = description.trim().replace(/\s\(\d+\/\d+\)$/, '');
        const editedTransactionDate = new Date(transactionDate + 'T12:00:00');
        const installmentRows = rows.filter((item) =>
          item.installmentGroupId === transaction.installmentGroupId && item.userId === userId
        );

        await Promise.all(
          installmentRows.map((row) => {
            const isEdited = row.id === transaction.id;
            // "Esta e as próximas": installments before this one stay as they are.
            if (!isEdited && appliedScope === 'following' && Number(row.installmentCurrent) < Number(transaction.installmentCurrent)) {
              return Promise.resolve();
            }
            if (isEdited) return transactionsResource.update(row.id, updates);

            // The other installments follow the edited one (same fields) but keep their own number, metadata and,
            // unless the app generated them, their own date.
            const { metadata: _metadata, date: _date, ...shared } = updates;
            const patch = {
              ...shared,
              description: `${baseDescription} (${row.installmentCurrent}/${row.installmentTotal})`,
              installmentCurrent: row.installmentCurrent,
              installmentTotal: row.installmentTotal,
              autoGenerated: row.autoGenerated,
            };
            if (row.autoGenerated) {
              const shifted = new Date(editedTransactionDate);
              shifted.setMonth(shifted.getMonth() + (row.installmentCurrent - transaction.installmentCurrent));
              patch.date = shifted.toISOString();
            }
            return transactionsResource.update(row.id, patch);
          })
        );
      } else {
        // Update only the single transaction
        await transactionsResource.update(transaction.id, updates);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert(pt ? 'Não foi possível salvar. Tente novamente.' : 'Failed to update transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (loading || !amount || amount <= 0 || !description.trim()) return;
    if (!isDraftMode && isInstallmentTransaction) {
      setConfirm('save');
      return;
    }
    submit('single');
  };

  if (!isOpen || !transaction) return null;

  const canSave = canWrite && !loading && amount > 0 && description.trim().length > 0;
  const showDelete = canWrite && !isDraftMode;
  const typeLabel = (kind) => (isTransfer
    ? kind === 'expense' ? (pt ? 'Saída' : 'Outgoing') : (pt ? 'Entrada' : 'Incoming')
    : kind === 'expense' ? (pt ? 'Saída' : 'Expense') : (pt ? 'Entrada' : 'Income'));
  const uncatName = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
  const allCategories = categories[type] || [];
  const orphanCategory = category && category !== uncatName && !allCategories.includes(category) ? category : null;
  const uncatEntry = allCategories.find(c => c === uncatName);
  const restCategories = allCategories.filter(c => c !== uncatName).sort((a, b) => a.localeCompare(b));
  const seriesLabel = isInstallmentTransaction ? `${transaction.installmentCurrent}/${transaction.installmentTotal}` : null;

  const textInput = (value, setValue, props = {}) => (
    <input type="text" value={value} onChange={(e) => setValue(e.target.value)} className={FIELD} {...props} />
  );

  const footer = (
    <div className="flex flex-col gap-1">
      <button
        type="submit"
        form="edit-transaction-form"
        disabled={!canSave}
        className="w-full min-h-[48px] rounded-xl bg-[var(--rw-brand)] text-base font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
      </button>
      {showDelete && (
        <button
          type="button"
          onClick={() => { setScope('single'); setDeleteLinkedInvestment(false); setConfirm('delete'); }}
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-red-500 disabled:opacity-50"
        >
          {pt ? 'Excluir' : 'Delete'}
        </button>
      )}
    </div>
  );

  return (
    <>
      <BottomSheet
        title={pt ? 'Editar transação' : 'Edit transaction'}
        subtitle={seriesLabel ? (pt ? `Parcela ${seriesLabel}` : `Installment ${seriesLabel}`) : undefined}
        onClose={() => (confirm ? setConfirm(null) : onClose())}
        footer={footer}
      >
        <form id="edit-transaction-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
          {/* Entrada / Saída */}
          <div className="flex gap-1 p-1 bg-[var(--rw-raised)] rounded-xl" role="radiogroup" aria-label={pt ? 'Tipo' : 'Type'}>
            {['expense', 'income'].map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={type === kind}
                onClick={() => changeType(kind)}
                className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                  type === kind
                    ? kind === 'income' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    : 'text-[var(--rw-muted)]'
                }`}
              >
                {typeLabel(kind)}
              </button>
            ))}
          </div>

          {/* Valor */}
          <Field label={pt ? 'Valor' : 'Amount'}>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              className="!text-3xl !font-extrabold !text-center !py-4 tabular-nums"
              aria-label={pt ? 'Valor' : 'Amount'}
            />
          </Field>

          {/* Título */}
          <Field label={pt ? 'Título' : 'Title'}>
            {textInput(description, setDescription, { required: true, placeholder: t('transactionForm.descriptionPlaceholder') })}
          </Field>

          {/* Categoria (a transfer has none) */}
          {!isTransfer && (
            <Field label={t('transactionForm.category')}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT} style={SELECT_STYLE}>
                {/* A category that is not in the list (disabled, renamed, other language) must still show as itself. */}
                {orphanCategory && <option value={orphanCategory}>{orphanCategory}</option>}
                {uncatEntry && <option value={uncatEntry}>{uncatEntry}</option>}
                {(uncatEntry || orphanCategory) && <optgroup label="──────────────" />}
                {restCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>
          )}

          {/* Investment details (only when the category is Investments) */}
          {showInvestmentFields && (
            <div className="space-y-3 p-3 bg-[var(--rw-raised)] rounded-xl">
              <Field label={t('investments.type')}>
                <select value={investmentType} onChange={(e) => setInvestmentType(e.target.value)} className={SELECT} style={SELECT_STYLE}>
                  {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>{info.icon} {t(`investments.types.${key}`)}</option>
                  ))}
                </select>
              </Field>
              {investmentType === 'fixed_income' && (
                <>
                  <Field label={pt ? 'Rendimento esperado' : 'Expected return'}>
                    <PercentInput value={expectedReturn ?? 0} onChange={setExpectedReturn} className="w-full min-h-[48px] !text-base" />
                  </Field>
                  <Field label={pt ? 'Vencimento (opcional)' : 'Maturity date (optional)'}>
                    <DateInput value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} className={FIELD} />
                  </Field>
                </>
              )}
              {(investmentType === 'stocks' || investmentType === 'fii') && (
                <>
                  <Field label={`Ticker ${investmentType === 'fii' ? '(HGLG11, XPML11)' : '(PETR4, AAPL)'}`}>
                    {textInput(ticker, (v) => setTicker(v.toUpperCase()), { placeholder: investmentType === 'fii' ? 'HGLG11' : 'PETR4' })}
                  </Field>
                  <Field label={pt ? 'Corretora' : 'Broker'}>
                    {textInput(platform, setPlatform, { placeholder: 'XP, Clear, Rico' })}
                  </Field>
                </>
              )}
              {investmentType === 'crypto' && (
                <>
                  <Field label={pt ? 'Criptomoeda' : 'Cryptocurrency'}>
                    {textInput(coinName, setCoinName, { list: 'crypto-list-edit', placeholder: 'Bitcoin (BTC)' })}
                    <datalist id="crypto-list-edit">
                      {['Bitcoin (BTC)', 'Ethereum (ETH)', 'BNB', 'Solana (SOL)', 'Cardano (ADA)', 'XRP', 'Dogecoin (DOGE)', 'Polygon (MATIC)', 'Avalanche (AVAX)', 'Chainlink (LINK)'].map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                  <Field label="Exchange">
                    {textInput(platform, setPlatform, { placeholder: 'Binance, Coinbase' })}
                  </Field>
                </>
              )}
              {investmentType === 'funds' && (
                <>
                  <Field label={pt ? 'Nome do fundo' : 'Fund name'}>
                    {textInput(fundName, setFundName, { placeholder: pt ? 'Ex: Fundo XP Ibovespa' : 'e.g. XP Ibovespa Fund' })}
                  </Field>
                  <Field label={pt ? 'Plataforma' : 'Platform'}>
                    {textInput(platform, setPlatform, { placeholder: 'XP, Rico' })}
                  </Field>
                </>
              )}
            </div>
          )}

          {/* Data */}
          <Field label={t('transactionForm.date')}>
            <DateInput
              lang={pt ? 'pt-BR' : 'en-US'}
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className={FIELD}
            />
          </Field>

          {/* Conta / Cartão */}
          <Field label={pt ? 'Conta ou cartão' : 'Account or card'}>
            <select value={selectedBankId || 'cash'} onChange={(e) => changeBank(e.target.value)} className={SELECT} style={SELECT_STYLE}>
              <option value="cash">{pt ? '💵 Sem conta (dinheiro)' : '💵 No account (cash)'}</option>
              {userBanks.map((userBank) => (
                <option key={userBank.id} value={userBank.id}>
                  {getBankInfo(userBank.bankId).icon} {getBankDisplayName(userBank)}
                </option>
              ))}
            </select>
          </Field>

          {/* Forma de pagamento: the options depend on the kind of entry */}
          <Field label={pt ? 'Forma de pagamento' : 'Payment method'}>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {methodsFor(type, isTransfer).map((method) => (
                <button
                  key={method}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === method}
                  onClick={() => setPaymentMethod(method)}
                  className={`min-h-[44px] min-w-[5.5rem] flex-1 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    paymentMethod === method
                      ? 'border-[var(--rw-brand)] bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]'
                      : 'border-[var(--rw-border)] text-[var(--rw-muted)]'
                  }`}
                >
                  {METHOD_LABEL[method][pt ? 'pt' : 'en']}
                </button>
              ))}
            </div>
          </Field>

          {/* Mais opções */}
          <div className="rounded-xl border border-[var(--rw-border)]">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex w-full min-h-[48px] items-center justify-between px-4 text-left text-sm font-bold text-[var(--rw-ink)]"
            >
              {pt ? 'Mais opções' : 'More options'}
              <span className={`text-[var(--rw-muted)] transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
            </button>
            {moreOpen && (
              <div className="space-y-4 px-4 pb-4">
                <Field label={pt ? 'Descrição (opcional)' : 'Description (optional)'}>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className={`${FIELD} min-h-[88px] resize-none`}
                    placeholder={pt ? 'Detalhes que ajudem a lembrar desta transação' : 'Details to help you remember this transaction'}
                  />
                </Field>

                {(isInstallmentTransaction || transaction.isRecurring) && (
                  <div className="space-y-1 rounded-xl bg-[var(--rw-raised)] p-3 text-sm text-[var(--rw-muted)]">
                    {isInstallmentTransaction && (
                      <p>{pt ? `Parcela ${seriesLabel}. Ao salvar ou excluir você escolhe se vale só para esta, para as próximas ou para todas.` : `Installment ${seriesLabel}. When saving or deleting you choose which ones it applies to.`}</p>
                    )}
                    {transaction.isRecurring && (
                      <p>
                        {pt ? 'Recorrente' : 'Recurring'}
                        {transaction.recurrenceFrequency ? `: ${{ monthly: pt ? 'mensal' : 'monthly', weekly: pt ? 'semanal' : 'weekly', yearly: pt ? 'anual' : 'yearly' }[transaction.recurrenceFrequency] || transaction.recurrenceFrequency}` : ''}
                      </p>
                    )}
                  </div>
                )}

                <ToggleRow
                  checked={isTransfer}
                  onChange={toggleTransfer}
                  title={`🔁 ${pt ? 'Transferência entre minhas contas' : 'Transfer between my accounts'}`}
                  hint={pt ? 'Fica fora das receitas e despesas e é ligada ao outro lado, se já estiver registrado.' : 'Left out of income and expenses and linked to the other side, if already recorded.'}
                />
                <ToggleRow
                  checked={isIgnored || isTransfer}
                  onChange={setIsIgnored}
                  disabled={isTransfer}
                  title={`🚫 ${t('transactionForm.ignoreTransaction')}`}
                />

                {!isTransfer && availableGoals.length > 0 && (
                  <Field label={t('goals.linkToGoal')}>
                    <select value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} className={SELECT} style={SELECT_STYLE}>
                      <option value="">{t('goals.noGoalSelected')}</option>
                      {availableGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                    </select>
                  </Field>
                )}

                {showPlannerGoal && (
                  <Field label={pt ? 'Objetivo do planner' : 'Planner objective'}>
                    {plannerGoals.length > 0 ? (
                      <select value={selectedPlannerGoalId} onChange={(e) => setSelectedPlannerGoalId(e.target.value)} className={SELECT} style={SELECT_STYLE}>
                        <option value="">{pt ? 'Nenhum' : 'None'}</option>
                        {plannerGoals.map(g => (
                          <option key={g.id} value={g.id}>{g.layerLabel ? `${g.layerLabel} › ${g.label}` : g.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="p-3 text-sm rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        {pt
                          ? 'Nenhum objetivo de investimento configurado no planner.'
                          : 'No investment objectives configured in the planner.'}
                      </p>
                    )}
                  </Field>
                )}
              </div>
            )}
          </div>
        </form>
      </BottomSheet>

      {/* One confirmation sheet: which installments to save to, or which to delete */}
      {confirm && (
        <BottomSheet
          title={confirm === 'delete' ? (pt ? 'Excluir transação' : 'Delete transaction') : (pt ? 'Salvar alterações' : 'Save changes')}
          subtitle={isInstallmentTransaction ? (pt ? `Esta é a parcela ${seriesLabel}.` : `This is installment ${seriesLabel}.`) : undefined}
          onClose={() => setConfirm(null)}
          footer={
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => (confirm === 'delete' ? handleDelete() : submit(scope))}
                className={`w-full min-h-[48px] rounded-xl text-base font-bold text-white disabled:opacity-50 ${confirm === 'delete' ? 'bg-red-500' : 'bg-[var(--rw-brand)]'}`}
              >
                {confirm === 'delete'
                  ? (loading ? (pt ? 'Excluindo…' : 'Deleting…') : (pt ? 'Excluir' : 'Delete'))
                  : (loading ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save'))}
              </button>
              <button type="button" onClick={() => setConfirm(null)} className="w-full min-h-[44px] text-sm font-semibold text-[var(--rw-muted)]">
                {t('common.cancel')}
              </button>
            </div>
          }
        >
          {isInstallmentTransaction ? (
            <div className="space-y-2" role="radiogroup" aria-label={pt ? 'Parcelas' : 'Installments'}>
              <RadioRow danger={confirm === 'delete'} checked={scope === 'single'} onSelect={() => setScope('single')} title={pt ? 'Só esta parcela' : 'Only this installment'} />
              <RadioRow danger={confirm === 'delete'} checked={scope === 'following'} onSelect={() => setScope('following')} title={pt ? 'Esta e as próximas' : 'This and the next ones'} />
              <RadioRow danger={confirm === 'delete'} checked={scope === 'group'} onSelect={() => setScope('group')} title={pt ? 'Todas as parcelas' : 'All installments'} />
            </div>
          ) : (
            <p className="text-sm text-[var(--rw-muted)]">
              {pt ? 'Tem certeza que quer excluir esta transação?' : 'Are you sure you want to delete this transaction?'}
            </p>
          )}

          {confirm === 'delete' && hasLinkedInvestment && (
            <div className="space-y-2 pt-2" role="radiogroup" aria-label={pt ? 'Investimento vinculado' : 'Linked investment'}>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--rw-muted)]">{pt ? 'Investimento vinculado' : 'Linked investment'}</p>
              <RadioRow danger checked={!deleteLinkedInvestment} onSelect={() => setDeleteLinkedInvestment(false)} title={pt ? 'Manter o investimento' : 'Keep the investment'} />
              <RadioRow danger checked={deleteLinkedInvestment} onSelect={() => setDeleteLinkedInvestment(true)} title={pt ? 'Excluir também o investimento' : 'Delete the investment too'} />
            </div>
          )}
          {confirm === 'delete' && (
            <p className="text-xs text-[var(--rw-muted)]">{pt ? 'Esta ação não pode ser desfeita.' : 'This cannot be undone.'}</p>
          )}
        </BottomSheet>
      )}
    </>
  );
}
