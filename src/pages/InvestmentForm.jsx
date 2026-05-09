import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import CurrencyInput from '../components/ui/CurrencyInput';
import PageHeader from '../components/PageHeader';
import usePlannerGoals from './planner/usePlannerGoals';

/** Native select chevron — matches TransactionModal / transaction forms */
const SELECT_CHEVRON_STYLE = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '20px',
};

const investmentTypeSelectClassName =
  'w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition-all duration-200 appearance-none cursor-pointer pr-10';

export default function InvestmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  // Determine mode from URL path or location state
  const getMode = () => {
    if (location.state?.mode) return location.state.mode;
    if (location.pathname.includes('/withdraw')) return 'withdraw';
    if (id) return 'edit';
    return 'add';
  };
  const mode = getMode(); // 'add', 'edit', or 'withdraw'

  const {
    investments,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    withdrawFromInvestment,
    getCurrentValue,
    calculateTaxes,
    getInvestmentColor,
    getInvestmentType,
  } = useInvestments();

  const { formatCurrency, t, language } = useSettings();
  const { goals, getGoalColor } = useGoals();

  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [investment, setInvestment] = useState(null);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: '',
    type: 'fixed_income',
    bank: '',
    initialAmount: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    goalId: '',
    plannerGoalId: '',
    notes: '',
    ticker: '',
  });

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [isFullWithdrawal, setIsFullWithdrawal] = useState(false);
  const [withdrawGoalId, setWithdrawGoalId] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split('T')[0]);

  // Non-completed goals for linking
  const availableGoals = goals.filter(g => !g.completed);
  const plannerGoals = usePlannerGoals();

  // Load investment data if editing or withdrawing
  useEffect(() => {
    if (id) {
      const inv = investments.find(i => i.id === id);
      if (inv) {
        setInvestment(inv);

        if (mode === 'edit') {
          setFormData({
            name: inv.name,
            type: inv.type,
            bank: inv.bank || '',
            initialAmount: inv.initialAmount,
            purchaseDate: inv.purchaseDate || new Date().toISOString().split('T')[0],
            goalId: inv.goalId || '',
            plannerGoalId: inv.plannerGoalId || '',
            notes: inv.notes || '',
            ticker: inv.ticker || '',
          });
        } else if (mode === 'withdraw') {
          const currentValue = getCurrentValue(inv);
          setWithdrawAmount(currentValue);
          setIsFullWithdrawal(true);
        }
      } else {
        // Investment not found, redirect
        navigate('/investments');
      }
    }
  }, [id, investments, mode, location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || (!id && !formData.initialAmount)) return;

    setLoading(true);
    try {
      const investmentData = {
        name: formData.name.trim(),
        type: formData.type,
        bank: formData.bank.trim(),
        initialAmount: formData.initialAmount,
        purchaseDate: formData.purchaseDate || null,
        goalId: formData.goalId || null,
        plannerGoalId: formData.plannerGoalId || null,
        notes: formData.notes.trim(),
        ticker: formData.ticker.trim().toUpperCase() || null,
      };

      if (id) {
        const success = await updateInvestment(id, investmentData);
        if (!success) {
          alert(language === 'pt' ? 'Erro ao atualizar investimento. Tente novamente.' : 'Error updating investment. Please try again.');
          return;
        }
      } else {
        await addInvestment(investmentData, true);
      }

      navigate('/investments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteInvestment(id);
      navigate('/investments');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > getCurrentValue(investment)) return;

    setLoading(true);
    try {
      const result = await withdrawFromInvestment(
        id,
        withdrawAmount,
        {
          goalId: withdrawGoalId || null,
          createTransaction: true,
          withdrawDate: withdrawDate || new Date().toISOString().split('T')[0]
        }
      );

      if (result.success) {
        navigate('/investments');
      } else {
        alert(language === 'pt' ? 'Erro ao realizar resgate. Tente novamente.' : 'Error withdrawing. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFullWithdrawalToggle = (checked) => {
    setIsFullWithdrawal(checked);
    if (checked && investment) {
      setWithdrawAmount(getCurrentValue(investment));
    }
  };

  const headerTitle =
    mode === 'add'
      ? t('investments.newInvestment')
      : mode === 'edit'
        ? t('investments.editInvestment')
        : t('investments.withdraw');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <PageHeader title={headerTitle} showMonth={false} backTo="/investments" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
        {mode === 'withdraw' && investment ? (
          /* WITHDRAW VIEW */
          <div className="space-y-6">
            {/* Investment Preview Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${getInvestmentColor(getInvestmentType(investment.type).color).light} rounded-xl flex items-center justify-center text-2xl`}>
                  {getInvestmentType(investment.type).icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{investment.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('investments.currentAmount')}: {formatCurrency(getCurrentValue(investment))}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 space-y-6">
              {/* Full Withdrawal Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFullWithdrawalToggle(!isFullWithdrawal)}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                    isFullWithdrawal
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                >
                  {isFullWithdrawal && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('investments.fullWithdrawal')}
                </label>
              </div>

              {/* Withdraw Amount Input */}
              {!isFullWithdrawal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.withdrawAmount')}
                  </label>
                  <CurrencyInput
                    value={withdrawAmount}
                    onChange={setWithdrawAmount}
                  />
                  {withdrawAmount > getCurrentValue(investment) && (
                    <p className="mt-2 text-sm text-rose-500 dark:text-rose-400">
                      {language === 'pt' ? 'Valor maior que o disponível' : 'Amount exceeds available balance'}
                    </p>
                  )}
                </div>
              )}

              {/* Withdrawal Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Data do Resgate' : 'Withdrawal Date'}
                </label>
                <input
                  type="date"
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white
                    focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                />
              </div>

              {/* Tax Preview for Fixed Income */}
              {(() => {
                const taxes = calculateTaxes(investment);
                const isFixedIncome = investment.type === 'fixed_income' || investment.returnType === 'cdi';
                if (!isFixedIncome || taxes.grossProfit <= 0) return null;

                const withdrawRatio = withdrawAmount / getCurrentValue(investment);
                const estimatedTaxes = taxes.totalTaxes * withdrawRatio;

                return (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-xl">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                      {language === 'pt' ? 'Impostos estimados no resgate:' : 'Estimated taxes on withdrawal:'}
                    </p>
                    <p className="text-base text-amber-800 dark:text-amber-200 font-bold">
                      IOF + IR: ~{formatCurrency(estimatedTaxes)}
                    </p>
                  </div>
                );
              })()}

              {/* Goal Selector */}
              {availableGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('investments.contributeToGoal')}
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {/* No goal option */}
                    <button
                      type="button"
                      onClick={() => setWithdrawGoalId('')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        !withdrawGoalId
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{t('investments.noGoal')}</span>
                    </button>

                    {/* Goal options */}
                    {availableGoals.map((goal) => {
                      const color = getGoalColor(goal.color);
                      const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setWithdrawGoalId(goal.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            withdrawGoalId === goal.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <div className={`w-10 h-10 ${color.light} rounded-lg flex items-center justify-center text-lg`}>
                            {icon}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > getCurrentValue(investment) || loading}
                className="w-full py-3.5 bg-emerald-500 text-white text-base font-bold rounded-xl
                  hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading
                  ? (language === 'pt' ? 'Processando...' : 'Processing...')
                  : t('investments.confirmWithdraw')}
              </button>
            </div>
          </div>
        ) : (
          /* ADD/EDIT FORM VIEW */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.name')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                  placeholder={t('investments.namePlaceholder')}
                />
              </div>

              {/* Type — same dropdown pattern as transaction add/edit (Investments category) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.type')}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={investmentTypeSelectClassName}
                  style={SELECT_CHEVRON_STYLE}
                >
                  {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.icon} {t(`investments.types.${key}`)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bank / Platform */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.bank')}
                </label>
                <input
                  type="text"
                  value={formData.bank}
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                  placeholder={t('investments.bankPlaceholder')}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 space-y-6">
              {/* Initial Amount (only for new investments) */}
              {!id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.initialAmount')}
                  </label>
                  <CurrencyInput
                    value={formData.initialAmount}
                    onChange={(val) => setFormData({ ...formData, initialAmount: val })}
                  />
                </div>
              )}

              {/* Purchase Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.purchaseDate')}
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white
                    focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Link to Goal */}
            {availableGoals.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('investments.linkToGoal')}
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* No goal option */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, goalId: '' })}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      !formData.goalId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{t('investments.noGoalSelected')}</span>
                  </button>

                  {/* Goal options */}
                  {availableGoals.map((goal) => {
                    const color = getGoalColor(goal.color);
                    const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, goalId: goal.id })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          formData.goalId === goal.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className={`w-10 h-10 ${color.light} rounded-lg flex items-center justify-center text-lg`}>
                          {icon}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Planner goal link */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Objetivo do planner
              </label>
              {plannerGoals.length > 0 ? (
                <select
                  value={formData.plannerGoalId}
                  onChange={e => setFormData(prev => ({ ...prev, plannerGoalId: e.target.value }))}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
                >
                  <option value="">Nenhum</option>
                  {plannerGoals.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Nenhum objetivo de investimento configurado no planner. Acesse o planejador para criar objetivos de investimento nas camadas de wallet.
                  </p>
                </div>
              )}
            </div>

            {/* Ticker — shown only for B3-eligible types */}
            {['stocks', 'fii', 'funds'].includes(formData.type) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Ticker B3 (opcional)' : 'B3 Ticker (optional)'}
                </label>
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                  placeholder="Ex: ITSA4, MXRF11"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                    focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition uppercase"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {language === 'pt'
                    ? 'Necessário para sincronização automática com a B3'
                    : 'Required for automatic B3 sync'}
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('investments.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                  text-gray-900 dark:text-white placeholder-gray-400
                  focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition resize-none"
                placeholder={t('investments.notesPlaceholder')}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={!formData.name.trim() || (!id && !formData.initialAmount) || loading}
                className="w-full py-3.5 bg-blue-500 text-white text-base font-bold rounded-xl
                  hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (language === 'pt' ? 'Salvando...' : 'Saving...') : (id ? t('common.save') : t('investments.addInvestment'))}
              </button>

              {/* Withdraw Button (only when editing and investment exists) */}
              {id && investment && (
                <button
                  type="button"
                  onClick={() => navigate(`/investments/${id}/withdraw`)}
                  className="w-full py-3.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-base font-bold rounded-xl border-2 border-emerald-200 dark:border-emerald-800
                    hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                >
                  {t('investments.withdraw')}
                </button>
              )}

              {/* Delete Button (only when editing) */}
              {id && (
                confirmDelete ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border-2 border-red-100 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">{t('investments.confirmDelete')}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mb-3">{t('investments.deleteWarning')}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {t('common.delete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-3.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-base font-bold rounded-xl border-2 border-red-200 dark:border-red-800
                      hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                  >
                    {t('common.delete')} {t('investments.title').slice(0, -1)}
                  </button>
                )
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
