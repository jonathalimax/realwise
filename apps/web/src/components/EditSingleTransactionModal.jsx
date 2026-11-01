import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSettings, UNCATEGORIZED_CATEGORY } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
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

export default function EditSingleTransactionModal({ isOpen, onClose, transaction, onSuccess, onSaveDraft = null }) {
  const { ownerId } = useAccess();
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
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
  const [updateAllInstallments, setUpdateAllInstallments] = useState(true);
  const [showInstallmentConfirm, setShowInstallmentConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInstallmentScope, setDeleteInstallmentScope] = useState('single');
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
  const { goals } = useGoals();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank } = useCards();
  const { addInvestment, updateInvestment, investments } = useInvestments();

  const availableGoals = goals.filter(g => !g.completed);
  const plannerGoals = usePlannerGoals();
  const isDraftMode = Boolean(onSaveDraft);
  const linkedInvestment = transaction?.investmentId
    ? investments.find((item) => item.id === transaction.investmentId) ?? null
    : investments.find((item) => item.transactionId === transaction?.id) ?? null;
  const hasLinkedInvestment = Boolean(transaction?.investmentId || linkedInvestment);
  const isInstallmentTransaction = Boolean(transaction?.isInstallment && transaction?.installmentGroupId);

  // Populate form when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setDescription(transaction.description || '');
      setAmount(transaction.amount || 0);
      setCategory(transaction.category || '');
      setTransactionDate(transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      setSelectedGoalId(transaction.goalId || '');
      setSelectedPlannerGoalId(transaction.plannerGoalId || '');
      // Handle both old (bank type) and new (document ID) formats
      // Convert old format to new format by finding the user bank
      const storedAccount = transaction.accountId || transaction.bankId;
      const userBank = storedAccount ? findUserBank(storedAccount) : null;
      setSelectedBankId(userBank ? userBank.id : null);
      setIsIgnored(transaction.ignored || false);
      setIsTransfer(Boolean(transaction.isTransfer));
      setPaymentMethod(transaction.paymentMethod || (userBank ? (userBank.hasCredit ? 'credit' : 'debit') : 'cash'));
      setUpdateAllInstallments(transaction.isInstallment || false);
      setShowDeleteConfirm(false);
      setDeleteInstallmentScope('single');
      setDeleteLinkedInvestment(false);
      setInvestmentType(transaction.investmentType || 'fixed_income');

      // Load investment data if transaction is linked to an investment
      if (transaction.investmentId) {
        const linkedInvestment = investments.find(inv => inv.id === transaction.investmentId);
        if (linkedInvestment) {
          setExpectedReturn((linkedInvestment.expectedReturn || 0) * 100); // Convert to percentage
          setMaturityDate(linkedInvestment.maturityDate || '');
          setTicker(linkedInvestment.ticker || '');
          setPlatform(linkedInvestment.platform || '');
          setCoinName(linkedInvestment.coinName || '');
          setFundName(linkedInvestment.fundName || '');
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
  }, [transaction, investments, findUserBank]);

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

  const handleDelete = async () => {
    if (!transaction?.id) return;

    setLoading(true);
    try {
      await deleteTransactionWithLinks({
        transaction,
        deleteScope: isInstallmentTransaction ? deleteInstallmentScope : 'single',
        deleteLinkedInvestment,
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert(language === 'pt' ? 'Falha ao excluir a transacao. Tente novamente.' : 'Failed to delete transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !transaction) return;

    if (!isDraftMode && transaction.isInstallment && !showInstallmentConfirm) {
      setShowInstallmentConfirm(true);
      return;
    }
    setShowInstallmentConfirm(false);
    setLoading(true);

    try {
      const userId = transaction.userId || requireOwnerId(ownerId);

      const baseDate = new Date(transactionDate + 'T12:00:00');
      const selectedGoal = selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null;

      const finalCategory = isTransfer ? null : category; // a transfer has no category; otherwise as chosen (may be empty)

      const isInvestmentCategory = !isTransfer && (finalCategory === 'Investments' || finalCategory === 'Investimentos');

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
        description,
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
        const extraFields = (category === 'Investments' || category === 'Investimentos')
          ? buildInvestmentExtraFields()
          : {};

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

      // If this is an installment and user wants to update all
      if (transaction.isInstallment && transaction.installmentGroupId && updateAllInstallments) {
        const rows = await transactionsResource.list();

        const baseDescription = description.replace(/\s\(\d+\/\d+\)$/, '');

        const editedTransactionDate = new Date(transactionDate + 'T12:00:00');
        const installmentRows = rows.filter((item) =>
          item.installmentGroupId === transaction.installmentGroupId && item.userId === userId
        );

        await Promise.all(
          installmentRows.map((installmentData) => {
            const currentInstallmentDate = new Date(installmentData.date);
            if (currentInstallmentDate < editedTransactionDate && installmentData.id !== transaction.id) {
              return Promise.resolve();
            }

            const newDescription = `${baseDescription} (${installmentData.installmentCurrent}/${installmentData.installmentTotal})`;
            const nextDate = installmentData.autoGenerated
              ? new Date(
                new Date(editedTransactionDate).setMonth(
                  new Date(editedTransactionDate).getMonth()
                  + (installmentData.installmentCurrent - transaction.installmentCurrent)
                )
              ).toISOString()
              : updates.date;

            return transactionsResource.update(installmentData.id, {
              ...updates,
              description: newDescription,
              installmentCurrent: installmentData.installmentCurrent,
              installmentTotal: installmentData.installmentTotal,
              autoGenerated: installmentData.autoGenerated,
              date: nextDate,
            });
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
      alert('Failed to update transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full sm:max-w-lg transform overflow-hidden rounded-t-2xl sm:rounded-2xl bg-[var(--rw-surface)] p-6 shadow-xl transition-all max-h-[92vh] overflow-y-auto" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-xl font-bold text-[var(--rw-ink)]">
                    {language === 'pt' ? 'Editar Transação' : 'Edit Transaction'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-[var(--rw-muted)]" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type toggle: the labels become direction labels for a transfer */}
                  <div className="flex p-1 bg-[var(--rw-raised)] rounded-xl">
                    {['expense', 'income'].map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => changeType(kind)}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                          type === kind
                            ? 'bg-[var(--rw-raised)] text-[var(--rw-ink)] shadow-sm'
                            : 'text-[var(--rw-muted)] hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        {isTransfer
                          ? kind === 'expense' ? (language === 'pt' ? 'Saída' : 'Outgoing') : (language === 'pt' ? 'Entrada' : 'Incoming')
                          : kind === 'expense' ? t('transactionForm.expense') : t('transactionForm.income')}
                      </button>
                    ))}
                  </div>

                  {/* Transfer between the user's own accounts */}
                  <button
                    type="button"
                    onClick={() => toggleTransfer(!isTransfer)}
                    aria-pressed={isTransfer}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                      isTransfer ? 'border-violet-500 bg-[var(--rw-brand-soft)]' : 'border-[var(--rw-border)] hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium ${isTransfer ? 'text-[var(--rw-brand-ink)]' : 'text-[var(--rw-ink)]'}`}>
                        🔁 {language === 'pt' ? 'Transferência entre minhas contas' : 'Transfer between my accounts'}
                      </span>
                      <span className="block text-xs text-[var(--rw-muted)]">
                        {language === 'pt'
                          ? 'Fica fora das receitas e despesas e é ligada ao outro lado, se já estiver registrado.'
                          : 'Left out of income and expenses and linked to the other side, if already recorded.'}
                      </span>
                    </span>
                    <span className={`flex h-7 w-12 shrink-0 items-center rounded-full px-1.5 transition-colors ${isTransfer ? 'bg-[var(--rw-brand)]' : 'bg-[var(--rw-track)]'}`}>
                      <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${isTransfer ? 'translate-x-5' : 'translate-x-0'}`} />
                    </span>
                  </button>

                  {/* Row 1: Amount + Date */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {t('transactionForm.amount')}
                      </label>
                      <CurrencyInput value={amount} onChange={setAmount} />
                    </div>

                    {/* Date */}
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {t('transactionForm.date')}
                      </label>
                      <input
                        type="date"
                        lang={language === 'pt' ? 'pt-BR' : 'en-US'}
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="w-full px-3 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                          text-[var(--rw-ink)] text-sm
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* Row 2: Description + Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {t('transactionForm.description')}
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                          text-[var(--rw-ink)] placeholder-gray-400
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200"
                        placeholder={t('transactionForm.descriptionPlaceholder')}
                      />
                    </div>

                    {/* Category (not for transfers) */}
                    {!isTransfer && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {t('transactionForm.category')}
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                          text-[var(--rw-ink)]
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200 appearance-none cursor-pointer pr-10"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 12px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '20px'
                        }}
                      >
                        {(() => {
                          const uncatName = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
                          const all = categories[type] || [];
                          const uncatEntry = all.find(c => c === uncatName);
                          const rest = all.filter(c => c !== uncatName).sort((a, b) => a.localeCompare(b));
                          return (<>
                            {uncatEntry && <option value={uncatEntry}>{uncatEntry}</option>}
                            {uncatEntry && <optgroup label="──────────────" />}
                            {rest.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </>);
                        })()}
                      </select>
                    </div>
                    )}
                  </div>

                  {/* Investment Type (only shown when category is Investments) */}
                  {!isTransfer && (category === 'Investments' || category === 'Investimentos') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                          {t('investments.type')}
                        </label>
                        <select
                          value={investmentType}
                          onChange={(e) => setInvestmentType(e.target.value)}
                          className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-[var(--rw-ink)] focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer pr-10"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 12px center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '20px'
                          }}
                        >
                          {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                            <option key={key} value={key}>
                              {info.icon} {t(`investments.types.${key}`)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dynamic fields by investment type */}
                      <div className="space-y-3 p-3 bg-[var(--rw-raised)] rounded-xl">
                        {/* fixed_income fields */}
                        {investmentType === 'fixed_income' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Rendimento Esperado' : 'Expected Return'}
                              </label>
                              <PercentInput
                                value={expectedReturn ?? 0}
                                onChange={(val) => setExpectedReturn(val)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Data de Vencimento (opcional)' : 'Maturity Date (optional)'}
                              </label>
                              <input
                                type="date"
                                value={maturityDate}
                                onChange={(e) => setMaturityDate(e.target.value)}
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)]
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                          </>
                        )}

                        {/* stocks fields */}
                        {investmentType === 'stocks' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                Ticker {language === 'pt' ? '(ex: PETR4, AAPL)' : '(e.g. PETR4, AAPL)'}
                              </label>
                              <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="PETR4"
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Corretora (ex: XP, Clear, Rico)' : 'Broker (e.g. XP, Clear, Rico)'}
                              </label>
                              <input
                                type="text"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                placeholder={language === 'pt' ? 'XP Investimentos' : 'XP Investments'}
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                          </>
                        )}

                        {/* crypto fields */}
                        {investmentType === 'crypto' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Criptomoeda' : 'Cryptocurrency'}
                              </label>
                              <input
                                type="text"
                                list="crypto-list-edit"
                                value={coinName}
                                onChange={(e) => setCoinName(e.target.value)}
                                placeholder="Bitcoin (BTC)"
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                              <datalist id="crypto-list-edit">
                                <option value="Bitcoin (BTC)" />
                                <option value="Ethereum (ETH)" />
                                <option value="BNB" />
                                <option value="Solana (SOL)" />
                                <option value="Cardano (ADA)" />
                                <option value="XRP" />
                                <option value="Dogecoin (DOGE)" />
                                <option value="Polygon (MATIC)" />
                                <option value="Avalanche (AVAX)" />
                                <option value="Chainlink (LINK)" />
                              </datalist>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Exchange (ex: Binance, Coinbase)' : 'Exchange (e.g. Binance, Coinbase)'}
                              </label>
                              <input
                                type="text"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                placeholder="Binance"
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                          </>
                        )}

                        {/* funds fields */}
                        {investmentType === 'funds' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Nome do Fundo' : 'Fund Name'}
                              </label>
                              <input
                                type="text"
                                value={fundName}
                                onChange={(e) => setFundName(e.target.value)}
                                placeholder={language === 'pt' ? 'Ex: Fundo XP Ibovespa' : 'e.g. XP Ibovespa Fund'}
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Plataforma' : 'Platform'}
                              </label>
                              <input
                                type="text"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                placeholder={language === 'pt' ? 'Ex: XP, Rico' : 'e.g. XP, Rico'}
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                          </>
                        )}

                        {/* fii fields */}
                        {investmentType === 'fii' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                Ticker {language === 'pt' ? '(ex: HGLG11, XPML11)' : '(e.g. HGLG11, XPML11)'}
                              </label>
                              <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="HGLG11"
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                                {language === 'pt' ? 'Corretora' : 'Broker'}
                              </label>
                              <input
                                type="text"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value)}
                                placeholder={language === 'pt' ? 'Ex: XP, Clear' : 'e.g. XP, Clear'}
                                className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                                  text-[var(--rw-ink)] placeholder-gray-400
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200"
                              />
                            </div>
                          </>
                        )}

                      </div>
                    </>
                  )}

                  {/* Row 3: Bank + Ignore */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Selector */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {language === 'pt' ? 'Banco' : 'Bank'}
                      </label>
                      <select
                        value={selectedBankId || 'cash'}
                        onChange={(e) => {
                          const newBankId = e.target.value === 'cash' ? null : e.target.value;
                          setSelectedBankId(newBankId);
                          if (newBankId) {
                            const bank = findUserBank(newBankId);
                            const preferred = type === 'income' || isTransfer ? 'pix' : bank?.hasCredit ? 'credit' : 'debit';
                            setPaymentMethod((prev) => (methodsFor(type, isTransfer).includes(prev) && prev !== 'cash' ? prev : preferred));
                          } else {
                            setPaymentMethod('cash');
                          }
                        }}
                        className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                          text-[var(--rw-ink)]
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200 appearance-none cursor-pointer pr-10"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 12px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '20px'
                        }}
                      >
                        <option value="cash">{language === 'pt' ? '💵 Sem conta (dinheiro)' : '💵 No account (cash)'}</option>
                        {userBanks.map((userBank) => {
                          const bankInfo = getBankInfo(userBank.bankId);
                          const displayName = getBankDisplayName(userBank);
                          return (
                            <option key={userBank.id} value={userBank.id}>
                              {bankInfo.icon} {displayName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Ignore Toggle */}
                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={() => !isTransfer && setIsIgnored(!isIgnored)}
                        disabled={isTransfer}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          (isIgnored || isTransfer)
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                            : 'border-[var(--rw-border)] hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">🚫</span>
                          <div className="text-left">
                            <span className={`text-sm font-medium ${isIgnored ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--rw-ink)]'}`}>
                              {t('transactionForm.ignoreTransaction')}
                            </span>
                          </div>
                        </div>
                        <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                          isIgnored ? 'bg-amber-500' : 'bg-[var(--rw-track)]'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            isIgnored ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Payment method: the options depend on the kind of entry */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                      {language === 'pt' ? 'Forma de pagamento' : 'Payment method'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {methodsFor(type, isTransfer).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`min-w-[5.5rem] flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                            paymentMethod === method
                              ? 'border-gray-900 dark:border-gray-300 bg-gray-900 dark:bg-gray-300 text-white dark:text-gray-900'
                              : 'border-[var(--rw-border)] text-[var(--rw-muted)] hover:border-gray-400 dark:hover:border-gray-400'
                          }`}
                        >
                          {METHOD_LABEL[method][language === 'pt' ? 'pt' : 'en']}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link to Goal */}
                  {!isTransfer && availableGoals.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {t('goals.linkToGoal')}
                      </label>
                      <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl
                          text-[var(--rw-ink)]
                          focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                          transition-all duration-200 appearance-none cursor-pointer pr-10"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 12px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '20px'
                        }}
                      >
                        <option value="">{t('goals.noGoalSelected')}</option>
                        {availableGoals.map((goal) => (
                          <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Planner goal link (only shown when category is Investments and type is expense) */}
                  {(!isTransfer && type === 'expense' && (category === 'Investments' || category === 'Investimentos')) && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
                        {language === 'pt' ? 'Objetivo do planner' : 'Planner objective'}
                      </label>
                      {plannerGoals.length > 0 ? (
                        <select
                          value={selectedPlannerGoalId}
                          onChange={e => setSelectedPlannerGoalId(e.target.value)}
                          className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-[var(--rw-ink)] focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                        >
                          <option value="">{language === 'pt' ? 'Nenhum' : 'None'}</option>
                          {plannerGoals.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.layerLabel ? `${g.layerLabel} › ${g.label}` : g.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            {language === 'pt'
                              ? 'Nenhum objetivo de investimento configurado no planner. Acesse o planejador para criar objetivos de investimento nas camadas de wallet.'
                              : 'No investment objectives configured in planner. Access the planner to create investment objectives in wallet layers.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}


                  {!isDraftMode && showDeleteConfirm && (
                    <div className="space-y-4 p-4 rounded-xl border-2 border-red-100 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30">
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                          {language === 'pt' ? 'Confirmar exclusao' : 'Confirm deletion'}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                          {language === 'pt'
                            ? 'Essa acao nao pode ser desfeita.'
                            : 'This action cannot be undone.'}
                        </p>
                      </div>

                      {isInstallmentTransaction && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                            {language === 'pt' ? 'Parcelas' : 'Installments'}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteInstallmentScope('single')}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                deleteInstallmentScope === 'single'
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-300'
                              }`}
                            >
                              {language === 'pt' ? 'Apenas esta' : 'Only this one'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteInstallmentScope('group')}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                deleteInstallmentScope === 'group'
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-300'
                              }`}
                            >
                              {language === 'pt' ? 'Todas as parcelas' : 'All installments'}
                            </button>
                          </div>
                        </div>
                      )}

                      {hasLinkedInvestment && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                            {language === 'pt' ? 'Investimento vinculado' : 'Linked investment'}
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteLinkedInvestment(false)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors ${
                                !deleteLinkedInvestment
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-300'
                              }`}
                            >
                              {language === 'pt' ? 'Excluir so a transacao' : 'Delete transaction only'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteLinkedInvestment(true)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition-colors ${
                                deleteLinkedInvestment
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-300'
                              }`}
                            >
                              {language === 'pt'
                                ? 'Excluir transacao e investimento'
                                : 'Delete transaction and investment'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={loading}
                          className="flex-1 rounded-lg bg-red-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50 whitespace-nowrap"
                        >
                          {loading
                            ? (language === 'pt' ? 'Excluindo...' : 'Deleting...')
                            : (language === 'pt' ? 'Confirmar exclusao' : 'Confirm delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-gray-800 whitespace-nowrap"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-3 bg-[var(--rw-raised)] text-[var(--rw-ink)] rounded-xl font-medium
                        hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    {!isDraftMode && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={loading}
                        className="flex-1 rounded-xl border-2 border-red-200 bg-red-50 py-3 font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !amount || amount <= 0}
                      className={`flex-1 py-3 rounded-xl font-medium text-white transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${type === 'expense'
                          ? 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
                          : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
                        }`}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {language === 'pt' ? 'Salvando...' : 'Saving...'}
                        </span>
                      ) : (
                        t('common.save')
                      )}
                    </button>
                  </div>
                </form>

                {/* Installment confirmation overlay */}
                {showInstallmentConfirm && (
                  <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 rounded-2xl flex flex-col items-center justify-center p-6 gap-5">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[var(--rw-ink)] text-base mb-1">
                        {language === 'pt' ? 'Editar parcelas' : 'Edit installments'}
                      </p>
                      <p className="text-sm text-[var(--rw-muted)]">
                        {language === 'pt'
                          ? `Esta é a parcela ${transaction?.installmentCurrent}/${transaction?.installmentTotal}. O que deseja atualizar?`
                          : `This is installment ${transaction?.installmentCurrent}/${transaction?.installmentTotal}. What would you like to update?`}
                      </p>
                    </div>
                    <div className="flex flex-col w-full gap-2">
                      <button
                        type="button"
                        onClick={() => { setUpdateAllInstallments(true); setShowInstallmentConfirm(false); handleSubmit({ preventDefault: () => {} }); }}
                        className="w-full py-3 rounded-xl font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                      >
                        {language === 'pt' ? 'Atualizar todas as parcelas' : 'Update all installments'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setUpdateAllInstallments(false); setShowInstallmentConfirm(false); handleSubmit({ preventDefault: () => {} }); }}
                        className="w-full py-3 rounded-xl font-medium text-[var(--rw-ink)] bg-[var(--rw-raised)] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {language === 'pt' ? 'Atualizar apenas esta' : 'Update only this one'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInstallmentConfirm(false)}
                        className="w-full py-2 text-sm text-[var(--rw-muted)] hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        {language === 'pt' ? 'Cancelar' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
