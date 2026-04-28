import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import { useCards } from '../contexts/CardsContext';
import { INVESTMENT_TYPES, useInvestments } from '../contexts/InvestmentContext';
import CurrencyInput from './ui/CurrencyInput';
import { generateTransactionHash, generateInstallmentGroupId } from '../services/installments';
import PlannerGoalSelect from './PlannerGoalSelect';

export default function TransactionModal({ isOpen, onClose }) {
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedPlannerGoalId, setSelectedPlannerGoalId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [loading, setLoading] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  // Date state - default to today
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  // Installment state
  const [isInstallment, setIsInstallment] = useState(false);
  const [currentInstallmentStr, setCurrentInstallmentStr] = useState('1');
  const [totalInstallmentsStr, setTotalInstallmentsStr] = useState('2');
  // Ignore state
  const [isIgnored, setIsIgnored] = useState(false);
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('monthly'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  // Investment type state
  const [investmentType, setInvestmentType] = useState('fixed_income');
  // Investment extra fields
  const [ticker, setTicker] = useState('');
  const [platform, setPlatform] = useState('');
  const [coinName, setCoinName] = useState('');
  const [fundName, setFundName] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [returnType, setReturnType] = useState('annual');
  const [maturityDate, setMaturityDate] = useState('');

  const { categories, t, language } = useSettings();
  const { goals, addAmountToGoal, getGoalColor } = useGoals();
  const { userBanks, getBankInfo, getBankColor, findUserBank } = useCards();
  const { addInvestment } = useInvestments();

  const availableGoals = goals.filter(g => !g.completed);

  // When category is '' (fresh form), treat as the first category of current type
  const effectiveCategory = category || categories[type]?.[0] || '';

  // Debug logging for effective category and category changes
  useEffect(() => {
    console.log('[TransactionModal] Category changed to:', category, '| Effective:', effectiveCategory, '| Type:', type);
  }, [category]);

  useEffect(() => {
    console.log('[TransactionModal] Effective category:', effectiveCategory);
    console.log('[TransactionModal] Planner condition will be:', {
      effectiveCategory,
      isInvestments: effectiveCategory === 'Investments',
      isInvestimentos: effectiveCategory === 'Investimentos',
      conditionMet: (effectiveCategory === 'Investments' || effectiveCategory === 'Investimentos'),
      shouldShowPlanner: (effectiveCategory === 'Investments' || effectiveCategory === 'Investimentos')
    });
  }, [effectiveCategory]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setDescription('');
    setAmount(0);
    setCategory('');
    setSelectedGoalId('');
    setSelectedPlannerGoalId('');
    setSelectedBankId(null);
    setPaymentMethod('credit');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setIsInstallment(false);
    setCurrentInstallmentStr('1');
    setTotalInstallmentsStr('2');
    setIsIgnored(false);
    setIsRecurring(false);
    setRecurrenceFrequency('monthly');
    setRecurrenceEndDate('');
    setSuccessMessage('');
    setInvestmentType('fixed_income');
    setTicker('');
    setPlatform('');
    setCoinName('');
    setFundName('');
    setPropertyDescription('');
    setExpectedReturn('');
    setReturnType('annual');
    setMaturityDate('');
  };

  // Build extra investment fields based on investmentType
  const buildInvestmentExtraFields = () => {
    switch (investmentType) {
      case 'fixed_income':
        return {
          expectedReturn: expectedReturn !== '' ? parseFloat(expectedReturn) / 100 : 0,
          returnType: returnType || 'annual',
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
      case 'real_estate':
        return { propertyDescription: propertyDescription || '' };
      default:
        return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    setLoading(true);
    setSuccessMessage('');

    try {
      const selectedGoal = selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null;
      const baseDate = new Date(transactionDate + 'T12:00:00'); // Use noon to avoid timezone issues
      const baseCategory = category || categories[type][0];

      const currentInstallment = Math.max(1, parseInt(currentInstallmentStr) || 1);
      const totalInstallments = Math.max(2, parseInt(totalInstallmentsStr) || 2);

      if (isInstallment && totalInstallments >= 2) {
        const installmentGroupId = generateInstallmentGroupId({
          description,
          amount: parseFloat(amount),
          date: baseDate.toISOString()
        });

        console.log('[TransactionModal] Creating installments:', currentInstallment, 'to', totalInstallments);
        let totalInstallmentsCreated = 0;

        for (let i = currentInstallment; i <= totalInstallments; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(installmentDate.getMonth() + (i - currentInstallment));

          const installmentDescription = `${description} (${i}/${totalInstallments})`;
          const transactionData = {
            userId: auth.currentUser.uid,
            type,
            description: installmentDescription,
            amount: parseFloat(amount),
            category: baseCategory,
            createdAt: serverTimestamp(),
            date: installmentDate.toISOString(),
            goalId: selectedGoalId || null,
            goalName: selectedGoal?.name || null,
            plannerGoalId: selectedPlannerGoalId || null,
            bankId: selectedBankId || null,
            paymentMethod: selectedBankId ? paymentMethod : null,
            ignored: isIgnored,
            isInstallment: true,
            installmentCurrent: i,
            installmentTotal: totalInstallments,
            installmentGroupId,
            autoGenerated: i > currentInstallment,
            // Recurrence fields
            isRecurring: isRecurring,
            recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
            recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate + 'T12:00:00').toISOString() : null,
            // Investment type (if category is Investments)
            investmentType: (baseCategory === 'Investments' || baseCategory === 'Investimentos') ? investmentType : null
          };

          transactionData.hash = generateTransactionHash(transactionData);
          await addDoc(collection(db, 'transactions'), transactionData);
          totalInstallmentsCreated++;
        }

        // If category is Investments and it's an expense, create an investment record
        // Income with Investments category = dividends/returns, not a new investment
        const isInvestment = baseCategory === 'Investments' || baseCategory === 'Investimentos';
        if (isInvestment && type === 'expense') {
          const totalInvestmentAmount = parseFloat(amount) * totalInstallmentsCreated;
          const extraFields = buildInvestmentExtraFields();
          const investmentData = {
            name: description,
            type: investmentType,
            bank: selectedBankId || '',
            initialAmount: totalInvestmentAmount,
            currentAmount: totalInvestmentAmount,
            expectedReturn: extraFields.expectedReturn ?? 0,
            returnType: extraFields.returnType ?? 'annual',
            purchaseDate: baseDate.toISOString().split('T')[0],
            maturityDate: extraFields.maturityDate ?? null,
            goalId: selectedGoalId || null,
            plannerGoalId: selectedPlannerGoalId || null,
            notes: `Installment investment: ${totalInstallmentsCreated} payments of ${amount}`,
            ...extraFields,
          };
          await addInvestment(investmentData, false);
        }

        // If linked to a goal, add to goal progress for ALL installments created
        // Investments contribute positively (you're saving money)
        if (selectedGoalId) {
          const amountPerInstallment = (type === 'income' || isInvestment) ? parseFloat(amount) : -parseFloat(amount);
          const totalAmountToAdd = amountPerInstallment * totalInstallmentsCreated;
          console.log('[TransactionModal] Updating goal', selectedGoalId, 'with total amount:', totalAmountToAdd, '(', totalInstallmentsCreated, 'installments x', amountPerInstallment, ')');
          await addAmountToGoal(selectedGoalId, totalAmountToAdd);
        }
      } else {
        const transactionData = {
          userId: auth.currentUser.uid,
          type,
          description,
          amount: parseFloat(amount),
          category: baseCategory,
          createdAt: serverTimestamp(),
          date: baseDate.toISOString(),
          goalId: selectedGoalId || null,
          goalName: selectedGoal?.name || null,
          plannerGoalId: selectedPlannerGoalId || null,
          bankId: selectedBankId || null,
          paymentMethod: selectedBankId ? paymentMethod : null,
          ignored: isIgnored,
          // Recurrence fields
          isRecurring: isRecurring,
          recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
          recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate + 'T12:00:00').toISOString() : null,
          // Investment type (if category is Investments)
          investmentType: (baseCategory === 'Investments' || baseCategory === 'Investimentos') ? investmentType : null
        };

        transactionData.hash = generateTransactionHash(transactionData);
        const docRef = await addDoc(collection(db, 'transactions'), transactionData);

        // If category is Investments and it's an expense, create an investment record and link it
        // Income with Investments category = dividends/returns, not a new investment
        const isInvestment = baseCategory === 'Investments' || baseCategory === 'Investimentos';
        if (isInvestment && type === 'expense') {
          const extraFields = buildInvestmentExtraFields();
          const investmentData = {
            name: description,
            type: investmentType,
            bank: selectedBankId || '',
            initialAmount: parseFloat(amount),
            currentAmount: parseFloat(amount),
            expectedReturn: extraFields.expectedReturn ?? 0,
            returnType: extraFields.returnType ?? 'annual',
            purchaseDate: baseDate.toISOString().split('T')[0],
            maturityDate: extraFields.maturityDate ?? null,
            goalId: selectedGoalId || null,
            plannerGoalId: selectedPlannerGoalId || null,
            notes: '',
            ...extraFields,
          };

          const investmentId = await addInvestment(investmentData, false);

          // Link transaction to investment
          if (investmentId) {
            await updateDoc(doc(db, 'transactions', docRef.id), {
              investmentId: investmentId
            });
          }
        }

        // If linked to a goal, add to goal progress
        // Investments contribute positively (you're saving money), other expenses subtract
        if (selectedGoalId) {
          const amountToAdd = (type === 'income' || isInvestment) ? parseFloat(amount) : -parseFloat(amount);
          console.log('[TransactionModal] Updating goal', selectedGoalId, 'with amount:', amountToAdd);
          await addAmountToGoal(selectedGoalId, amountToAdd);
        }
      }

      if (addAnother) {
        setSuccessMessage(language === 'pt' ? 'Transação adicionada!' : 'Transaction added!');
        setDescription('');
        setAmount(0);
        setIsInstallment(false);
        setCurrentInstallmentStr('1');
        setTotalInstallmentsStr('2');
        // Keep category, bank, and goal selection for convenience
      } else {
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction. Please try again.');
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('transactionForm.addTransaction')}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {successMessage && (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm">
                    {successMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type Toggle */}
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        type === 'expense'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {t('transactionForm.expense')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                        type === 'income'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {t('transactionForm.income')}
                    </button>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.amount')}
                    </label>
                    <CurrencyInput value={amount} onChange={setAmount} />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.description')}
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white placeholder-gray-400
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200"
                      placeholder={t('transactionForm.descriptionPlaceholder')}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.date')}
                    </label>
                    <input
                      type="date"
                      lang={language === 'pt' ? 'pt-BR' : 'en-US'}
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('transactionForm.category')}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200 appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '20px'
                      }}
                    >
                      {categories[type].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Investment Type (only shown when category is Investments) */}
                  {(effectiveCategory === 'Investments' || effectiveCategory === 'Investimentos') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('investments.type')}
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setInvestmentType(key)}
                            className={`p-3 text-xl rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                              investmentType === key
                                ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                            title={t(`investments.types.${key}`)}
                          >
                            <span>{info.icon}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
                              {t(`investments.types.${key}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Investment Fields (only when Investments category is selected) */}
                  {(effectiveCategory === 'Investments' || effectiveCategory === 'Investimentos') && (
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      {/* fixed_income fields */}
                      {investmentType === 'fixed_income' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {language === 'pt' ? 'Rendimento Esperado' : 'Expected Return'}
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={expectedReturn}
                                  onChange={(e) => setExpectedReturn(e.target.value)}
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="w-full px-4 py-3 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                    text-gray-900 dark:text-white placeholder-gray-400
                                    focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                    transition-all duration-200"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {language === 'pt' ? 'Tipo de Retorno' : 'Return Type'}
                              </label>
                              <select
                                value={returnType}
                                onChange={(e) => setReturnType(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                  text-gray-900 dark:text-white
                                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                  transition-all duration-200 appearance-none cursor-pointer pr-10"
                                style={{
                                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                  backgroundPosition: 'right 12px center',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundSize: '20px'
                                }}
                              >
                                <option value="cdi">CDI</option>
                                <option value="annual">{language === 'pt' ? 'Anual' : 'Annual'}</option>
                                <option value="monthly">{language === 'pt' ? 'Mensal' : 'Monthly'}</option>
                                <option value="total">Total</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Data de Vencimento (opcional)' : 'Maturity Date (optional)'}
                            </label>
                            <input
                              type="date"
                              value={maturityDate}
                              onChange={(e) => setMaturityDate(e.target.value)}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Ticker {language === 'pt' ? '(ex: PETR4, AAPL)' : '(e.g. PETR4, AAPL)'}
                            </label>
                            <input
                              type="text"
                              value={ticker}
                              onChange={(e) => setTicker(e.target.value.toUpperCase())}
                              placeholder="PETR4"
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
                                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                transition-all duration-200"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Corretora (ex: XP, Clear, Rico)' : 'Broker (e.g. XP, Clear, Rico)'}
                            </label>
                            <input
                              type="text"
                              value={platform}
                              onChange={(e) => setPlatform(e.target.value)}
                              placeholder={language === 'pt' ? 'XP Investimentos' : 'XP Investments'}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Criptomoeda' : 'Cryptocurrency'}
                            </label>
                            <input
                              type="text"
                              list="crypto-list"
                              value={coinName}
                              onChange={(e) => setCoinName(e.target.value)}
                              placeholder="Bitcoin (BTC)"
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
                                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                transition-all duration-200"
                            />
                            <datalist id="crypto-list">
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Exchange (ex: Binance, Coinbase)' : 'Exchange (e.g. Binance, Coinbase)'}
                            </label>
                            <input
                              type="text"
                              value={platform}
                              onChange={(e) => setPlatform(e.target.value)}
                              placeholder="Binance"
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Nome do Fundo' : 'Fund Name'}
                            </label>
                            <input
                              type="text"
                              value={fundName}
                              onChange={(e) => setFundName(e.target.value)}
                              placeholder={language === 'pt' ? 'Ex: Fundo XP Ibovespa' : 'e.g. XP Ibovespa Fund'}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
                                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                transition-all duration-200"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Plataforma' : 'Platform'}
                            </label>
                            <input
                              type="text"
                              value={platform}
                              onChange={(e) => setPlatform(e.target.value)}
                              placeholder={language === 'pt' ? 'Ex: XP, Rico' : 'e.g. XP, Rico'}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Ticker {language === 'pt' ? '(ex: HGLG11, XPML11)' : '(e.g. HGLG11, XPML11)'}
                            </label>
                            <input
                              type="text"
                              value={ticker}
                              onChange={(e) => setTicker(e.target.value.toUpperCase())}
                              placeholder="HGLG11"
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
                                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                transition-all duration-200"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {language === 'pt' ? 'Corretora' : 'Broker'}
                            </label>
                            <input
                              type="text"
                              value={platform}
                              onChange={(e) => setPlatform(e.target.value)}
                              placeholder={language === 'pt' ? 'Ex: XP, Clear' : 'e.g. XP, Clear'}
                              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                text-gray-900 dark:text-white placeholder-gray-400
                                focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                                transition-all duration-200"
                            />
                          </div>
                        </>
                      )}

                      {/* real_estate fields */}
                      {investmentType === 'real_estate' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {language === 'pt' ? 'Descrição do Imóvel' : 'Property Description'}
                          </label>
                          <input
                            type="text"
                            value={propertyDescription}
                            onChange={(e) => setPropertyDescription(e.target.value)}
                            placeholder={language === 'pt' ? 'Ex: Apartamento Centro, SP' : 'e.g. Downtown Apartment, SP'}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                              text-gray-900 dark:text-white placeholder-gray-400
                              focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                              transition-all duration-200"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bank Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {language === 'pt' ? 'Banco' : 'Bank'}
                    </label>
                    <select
                      value={selectedBankId || 'cash'}
                      onChange={(e) => {
                        const newBankId = e.target.value === 'cash' ? null : e.target.value;
                        setSelectedBankId(newBankId);
                        if (newBankId) {
                          const bank = findUserBank(newBankId);
                          setPaymentMethod(bank?.hasCredit ? 'credit' : 'debit');
                        } else {
                          setPaymentMethod('credit');
                        }
                      }}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white
                        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                        transition-all duration-200 appearance-none cursor-pointer pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '20px'
                      }}
                    >
                      <option value="cash">{language === 'pt' ? '💵 Dinheiro' : '💵 Cash'}</option>
                      {userBanks.map((userBank) => {
                        const bankInfo = getBankInfo(userBank.bankId);
                        const displayName = userBank.cardName || (userBank.bankId === 'other' && userBank.customBankName) || bankInfo.name;
                        return (
                          <option key={userBank.id} value={userBank.id}>
                            {bankInfo.icon} {displayName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Payment Method Selector */}
                  {selectedBankId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {language === 'pt' ? 'Forma de Pagamento' : 'Payment Method'}
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'credit', labelPt: 'Crédito', labelEn: 'Credit' },
                          { value: 'debit', labelPt: 'Débito', labelEn: 'Debit' },
                          { value: 'pix', labelPt: 'PIX', labelEn: 'PIX' },
                          { value: 'transfer', labelPt: 'Transferência', labelEn: 'Transfer' },
                        ].map((method) => (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => setPaymentMethod(method.value)}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                              paymentMethod === method.value
                                ? 'border-gray-900 dark:border-gray-300 bg-gray-900 dark:bg-gray-300 text-white dark:text-gray-900'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-400'
                            }`}
                          >
                            {language === 'pt' ? method.labelPt : method.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Installment Toggle (only for expenses) */}
                  {type === 'expense' && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsInstallment(!isInstallment)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isInstallment
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <span className={`text-sm font-medium ${isInstallment ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {t('transactionForm.isInstallment')}
                        </span>
                        <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                          isInstallment ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            isInstallment ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </button>

                      {isInstallment && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                {t('transactionForm.currentInstallment')}
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={currentInstallmentStr}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '');
                                  setCurrentInstallmentStr(raw);
                                }}
                                onBlur={() => {
                                  const total = Math.max(2, parseInt(totalInstallmentsStr) || 2);
                                  const val = Math.max(1, Math.min(parseInt(currentInstallmentStr) || 1, total));
                                  setCurrentInstallmentStr(String(val));
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded-lg text-center text-gray-900 dark:text-white
                                  focus:border-blue-500 focus:ring-0 focus:outline-none"
                              />
                            </div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium pt-5">{t('transactionForm.installmentOf')}</span>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                {t('transactionForm.totalInstallments')}
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={totalInstallmentsStr}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '');
                                  setTotalInstallmentsStr(raw);
                                }}
                                onBlur={() => {
                                  const val = Math.max(2, Math.min(parseInt(totalInstallmentsStr) || 2, 48));
                                  setTotalInstallmentsStr(String(val));
                                  const curr = Math.max(1, Math.min(parseInt(currentInstallmentStr) || 1, val));
                                  setCurrentInstallmentStr(String(curr));
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded-lg text-center text-gray-900 dark:text-white
                                  focus:border-blue-500 focus:ring-0 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link to Goal */}
                  {availableGoals.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('goals.linkToGoal')}
                      </label>
                      <select
                        value={selectedGoalId}
                        onChange={(e) => setSelectedGoalId(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                          text-gray-900 dark:text-white
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

                  {/* Planner Goal - Show for investment transactions */}
                  {(effectiveCategory === 'Investments' || effectiveCategory === 'Investimentos') && (
                    <PlannerGoalSelect
                      value={selectedPlannerGoalId}
                      onChange={setSelectedPlannerGoalId}
                      selectClassName="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer pr-10"
                    />
                  )}

                  {/* Recurrence Toggle */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setIsRecurring(!isRecurring)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isRecurring
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className={`text-sm font-medium ${isRecurring ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {language === 'pt' ? 'Transação Recorrente' : 'Recurring Transaction'}
                      </span>
                      <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                        isRecurring ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          isRecurring ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>

                    {isRecurring && (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl space-y-3">
                        {/* Recurrence Frequency */}
                        <div>
                          <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                            {language === 'pt' ? 'Frequência' : 'Frequency'}
                          </label>
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) => setRecurrenceFrequency(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                              text-gray-900 dark:text-white
                              focus:border-purple-500 focus:ring-0 focus:outline-none appearance-none cursor-pointer pr-10"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 12px center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '20px'
                            }}
                          >
                            <option value="daily">{language === 'pt' ? 'Diário' : 'Daily'}</option>
                            <option value="weekly">{language === 'pt' ? 'Semanal' : 'Weekly'}</option>
                            <option value="monthly">{language === 'pt' ? 'Mensal' : 'Monthly'}</option>
                            <option value="yearly">{language === 'pt' ? 'Anual' : 'Yearly'}</option>
                          </select>
                        </div>

                        {/* Recurrence End Date */}
                        <div>
                          <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                            {language === 'pt' ? 'Data Final (Opcional)' : 'End Date (Optional)'}
                          </label>
                          <input
                            type="date"
                            value={recurrenceEndDate}
                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg text-gray-900 dark:text-white
                              focus:border-purple-500 focus:ring-0 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ignore Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsIgnored(!isIgnored)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isIgnored
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🚫</span>
                      <div className="text-left">
                        <span className={`text-sm font-medium ${isIgnored ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {t('transactionForm.ignoreTransaction')}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('transactionForm.ignoreTransactionHint')}
                        </p>
                      </div>
                    </div>
                    <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                      isIgnored ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        isIgnored ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>

                  {/* Add Another Checkbox */}
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addAnother}
                      onChange={(e) => setAddAnother(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {language === 'pt' ? 'Adicionar outra transação depois' : 'Add another transaction after'}
                    </span>
                  </label>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !amount || amount <= 0}
                    className={`w-full py-3.5 rounded-xl font-medium text-white transition-all duration-200
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
                        {t('transactionForm.adding')}
                      </span>
                    ) : (
                      `${t('common.add')} ${type === 'expense' ? t('transactionForm.expense') : t('transactionForm.income')}`
                    )}
                  </button>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
