import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, writeBatch, query, collection, where, getDocs } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals } from '../contexts/GoalsContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments, INVESTMENT_TYPES, RETURN_TYPES } from '../contexts/InvestmentContext';
import { useAccess } from '../contexts/AccessContext';
import { buildUpdatedMetadata } from '../utils/transactionMetadata';
import CurrencyInput from '../components/ui/CurrencyInput';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function TransactionEditPage() {
  const { ownerId } = useAccess();
  const { id } = useParams();
  const navigate = useNavigate();

  // Page-level state
  const [transaction, setTransaction] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Form state
  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [isIgnored, setIsIgnored] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateAllInstallments, setUpdateAllInstallments] = useState(true);
  const [investmentType, setInvestmentType] = useState('fixed_income');
  const [paymentMethod, setPaymentMethod] = useState('debit');

  // Investment-specific fields
  const [expectedReturn, setExpectedReturn] = useState(0);
  const [returnType, setReturnType] = useState('annual');
  const [maturityDate, setMaturityDate] = useState('');
  const [ticker, setTicker] = useState('');
  const [platform, setPlatform] = useState('');
  const [coinName, setCoinName] = useState('');
  const [fundName, setFundName] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');

  const { categories, t, language } = useSettings();
  const { goals } = useGoals();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank } = useCards();
  const { addInvestment, updateInvestment, investments } = useInvestments();

  const availableGoals = goals.filter((g) => !g.completed);

  // Load transaction from Firestore by ID
  useEffect(() => {
    if (!id) {
      navigate(-1);
      return;
    }

    const fetchTransaction = async () => {
      try {
        const docRef = doc(db, 'transactions', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          navigate(-1);
          return;
        }

        const data = { id: docSnap.id, ...docSnap.data() };
        setTransaction(data);
      } catch (error) {
        console.error('Error fetching transaction:', error);
        navigate(-1);
      } finally {
        setPageLoading(false);
      }
    };

    fetchTransaction();
  }, [id, navigate]);

  // Populate form when transaction is loaded
  useEffect(() => {
    if (!transaction) return;

    setType(transaction.type || 'expense');
    setDescription(transaction.description || '');
    setAmount(transaction.amount || 0);
    setCategory(transaction.category || '');
    setTransactionDate(
      transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]
    );
    setSelectedGoalId(transaction.goalId || '');

    // Handle both old (bank type) and new (document ID) formats
    if (transaction.bankId) {
      const userBank = findUserBank(transaction.bankId);
      setSelectedBankId(userBank ? userBank.id : null);
    } else {
      setSelectedBankId(null);
    }

    setIsIgnored(transaction.ignored || false);
    setPaymentMethod(transaction.paymentMethod || 'debit');
    setUpdateAllInstallments(transaction.isInstallment || false);
    setInvestmentType(transaction.investmentType || 'fixed_income');

    // Load investment data if transaction is linked to an investment
    if (transaction.investmentId) {
      const linkedInvestment = investments.find((inv) => inv.id === transaction.investmentId);
      if (linkedInvestment) {
        setExpectedReturn((linkedInvestment.expectedReturn || 0) * 100);
        setReturnType(linkedInvestment.returnType || 'annual');
        setMaturityDate(linkedInvestment.maturityDate || '');
        setTicker(linkedInvestment.ticker || '');
        setPlatform(linkedInvestment.platform || '');
        setCoinName(linkedInvestment.coinName || '');
        setFundName(linkedInvestment.fundName || '');
        setPropertyDescription(linkedInvestment.propertyDescription || '');
      }
    } else {
      setExpectedReturn(0);
      setReturnType('annual');
      setMaturityDate('');
      setTicker('');
      setPlatform('');
      setCoinName('');
      setFundName('');
      setPropertyDescription('');
    }
  }, [transaction, investments, findUserBank]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !transaction?.id) return;

    setLoading(true);

    try {
      if (!auth.currentUser) {
        console.error('User not authenticated');
        alert('You are not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const baseDate = new Date(transactionDate + 'T12:00:00');
      const selectedGoal = selectedGoalId ? goals.find((g) => g.id === selectedGoalId) : null;

      const finalCategory = category || categories[type][0];
      const isInvestmentCategory =
        finalCategory === 'Investments' || finalCategory === 'Investimentos';

      const updatedMetadata = buildUpdatedMetadata(transaction.metadata, finalCategory, transaction.category);

      const updates = {
        userId: transaction.userId || ownerId || auth.currentUser.uid,
        type,
        description,
        amount: parseFloat(amount),
        category: finalCategory,
        date: baseDate.toISOString(),
        goalId: selectedGoalId || null,
        goalName: selectedGoal?.name || null,
        bankId: selectedBankId || null,
        paymentMethod: selectedBankId ? paymentMethod : null,
        ignored: isIgnored,
        investmentType: isInvestmentCategory ? investmentType : null,
        metadata: updatedMetadata,
      };

      const buildInvestmentExtraFields = () => {
        switch (investmentType) {
          case 'fixed_income':
            return { expectedReturn: parseFloat(expectedReturn) / 100 || 0, returnType: returnType || 'annual', maturityDate: maturityDate || null };
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

      // Handle investment record creation/update if category is Investments
      if (isInvestmentCategory) {
        const extraFields = buildInvestmentExtraFields();
        const investmentData = {
          name: description,
          type: investmentType,
          bank: selectedBankId || '',
          initialAmount: parseFloat(amount),
          currentAmount: parseFloat(amount),
          purchaseDate: transactionDate,
          goalId: selectedGoalId || null,
          notes: '',
          ...extraFields,
        };

        if (transaction.investmentId) {
          await updateInvestment(transaction.investmentId, investmentData);
        } else {
          const newInvestmentId = await addInvestment(investmentData, false);
          if (newInvestmentId) {
            updates.investmentId = newInvestmentId;
          }
        }
      }

      // If this is an installment and user wants to update all
      if (transaction.isInstallment && transaction.installmentGroupId && updateAllInstallments) {
        const q = query(
          collection(db, 'transactions'),
          where('installmentGroupId', '==', transaction.installmentGroupId),
          where('userId', '==', transaction.userId || ownerId || auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);

        const baseDescription = description.replace(/\s\(\d+\/\d+\)$/, '');

        querySnapshot.forEach((docSnapshot) => {
          const currentInstallmentDate = new Date(docSnapshot.data().date);
          const editedTransactionDate = new Date(transactionDate + 'T12:00:00');

          if (currentInstallmentDate >= editedTransactionDate || docSnapshot.id === transaction.id) {
            const installmentData = docSnapshot.data();
            const newDescription = `${baseDescription} (${installmentData.installmentCurrent}/${installmentData.installmentTotal})`;

            batch.update(docSnapshot.ref, {
              ...updates,
              description: newDescription,
              installmentCurrent: installmentData.installmentCurrent,
              installmentTotal: installmentData.installmentTotal,
              autoGenerated: installmentData.autoGenerated,
              date: installmentData.autoGenerated
                ? new Date(
                    new Date(editedTransactionDate).setMonth(
                      new Date(editedTransactionDate).getMonth() +
                        (installmentData.installmentCurrent - transaction.installmentCurrent)
                    )
                  ).toISOString()
                : updates.date,
            });
          }
        });

        await batch.commit();
      } else {
        await updateDoc(doc(db, 'transactions', transaction.id), updates);
      }

      navigate(-1);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while fetching from Firestore
  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Carregando...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-14 sm:h-16">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={language === 'pt' ? 'Voltar' : 'Go back'}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Editar Transação' : 'Edit Transaction'}
            </h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
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
                  backgroundSize: '20px',
                }}
              >
                {categories[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Investment Type (only shown when category is Investments) */}
            {(category === 'Investments' || category === 'Investimentos') && (
              <>
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

                {/* Dynamic Investment Fields by type */}
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
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
                              className="w-full px-4 py-3 pr-10 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
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
                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '20px', paddingRight: '2.5rem' }}
                          >
                            <option value={RETURN_TYPES.cdi}>CDI</option>
                            <option value={RETURN_TYPES.annual}>{language === 'pt' ? 'Anual' : 'Annual'}</option>
                            <option value={RETURN_TYPES.monthly}>{language === 'pt' ? 'Mensal' : 'Monthly'}</option>
                            <option value={RETURN_TYPES.total}>Total</option>
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
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </>
                  )}
                  {(investmentType === 'stocks' || investmentType === 'fii') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Ticker {investmentType === 'fii' ? (language === 'pt' ? '(ex: HGLG11)' : '(e.g. HGLG11)') : (language === 'pt' ? '(ex: PETR4)' : '(e.g. PETR4)')}
                        </label>
                        <input
                          type="text"
                          value={ticker}
                          onChange={(e) => setTicker(e.target.value.toUpperCase())}
                          placeholder={investmentType === 'fii' ? 'HGLG11' : 'PETR4'}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
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
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </>
                  )}
                  {investmentType === 'crypto' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {language === 'pt' ? 'Criptomoeda' : 'Cryptocurrency'}
                        </label>
                        <input
                          type="text"
                          list="edit-page-crypto-list"
                          value={coinName}
                          onChange={(e) => setCoinName(e.target.value)}
                          placeholder="Bitcoin (BTC)"
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                        <datalist id="edit-page-crypto-list">
                          <option value="Bitcoin (BTC)" /><option value="Ethereum (ETH)" /><option value="BNB" /><option value="Solana (SOL)" /><option value="Cardano (ADA)" /><option value="XRP" />
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {language === 'pt' ? 'Exchange' : 'Exchange'}
                        </label>
                        <input
                          type="text"
                          value={platform}
                          onChange={(e) => setPlatform(e.target.value)}
                          placeholder="Binance"
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </>
                  )}
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
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
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
                          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    </>
                  )}
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
                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Bank Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Banco' : 'Bank'}
              </label>
              <select
                value={selectedBankId || 'cash'}
                onChange={(e) => setSelectedBankId(e.target.value === 'cash' ? null : e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                  text-gray-900 dark:text-white
                  focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
                  transition-all duration-200 appearance-none cursor-pointer pr-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '20px',
                }}
              >
                <option value="cash">{language === 'pt' ? '💵 Dinheiro' : '💵 Cash'}</option>
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

            {/* Payment Method */}
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
                    backgroundSize: '20px',
                  }}
                >
                  <option value="">{t('goals.noGoalSelected')}</option>
                  {availableGoals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  <span
                    className={`text-sm font-medium ${
                      isIgnored
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {t('transactionForm.ignoreTransaction')}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('transactionForm.ignoreTransactionHint')}
                  </p>
                </div>
              </div>
              <div
                className={`w-12 h-7 rounded-full transition-colors flex items-center px-1.5 ${
                  isIgnored ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isIgnored ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            {/* Update All Installments Checkbox */}
            {transaction?.isInstallment && (
              <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateAllInstallments}
                  onChange={(e) => setUpdateAllInstallments(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {language === 'pt'
                    ? 'Atualizar todas as parcelas'
                    : 'Update all installments'}
                </span>
              </label>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium
                  hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !amount || amount <= 0}
                className={`flex-1 py-3 rounded-xl font-medium text-white transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    type === 'expense'
                      ? 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700'
                      : 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700'
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {language === 'pt' ? 'Salvando...' : 'Saving...'}
                  </span>
                ) : (
                  t('common.save')
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
