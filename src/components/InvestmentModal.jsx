import { useState } from 'react';
import { useInvestments, INVESTMENT_TYPES, INVESTMENT_COLORS, CDI_ANNUAL_RATE } from '../contexts/InvestmentContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import CurrencyInput from './ui/CurrencyInput';

export default function InvestmentModal({ isOpen, onClose }) {
  const {
    investments,
    loading,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    getCurrentValue,
    getGrowthPercentage,
    calculateTaxes,
    getInvestmentColor,
    getInvestmentType,
    getDaysUntilMaturity,
    getTotalInvested,
    getTotalCurrentValue,
    getTotalGrowth,
  } = useInvestments();
  const { formatCurrency, t, language } = useSettings();
  const { goals, getGoalColor } = useGoals();

  const [view, setView] = useState('list'); // 'list', 'form', 'updateValue'
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [selectedInvestmentForUpdate, setSelectedInvestmentForUpdate] = useState(null);
  const [newCurrentValue, setNewCurrentValue] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState('maturity'); // 'maturity', 'name', 'value', 'type'

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'fixed_income',
    bank: '',
    initialAmount: 0,
    expectedReturn: 0,
    returnType: 'annual',
    purchaseDate: new Date().toISOString().split('T')[0],
    maturityDate: '',
    goalId: '',
    notes: '',
  });

  // Non-completed goals for linking
  const availableGoals = goals.filter(g => !g.completed);

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'fixed_income',
      bank: '',
      initialAmount: 0,
      expectedReturn: 0,
      returnType: 'annual',
      purchaseDate: new Date().toISOString().split('T')[0],
      maturityDate: '',
      goalId: '',
      notes: '',
    });
    setEditingInvestment(null);
  };

  const handleOpenForm = (investment = null) => {
    if (investment) {
      setEditingInvestment(investment);
      setFormData({
        name: investment.name,
        type: investment.type,
        bank: investment.bank || '',
        initialAmount: investment.initialAmount,
        expectedReturn: (investment.expectedReturn || 0) * 100, // Convert to percentage
        returnType: investment.returnType || 'annual',
        purchaseDate: investment.purchaseDate || new Date().toISOString().split('T')[0],
        maturityDate: investment.maturityDate || '',
        goalId: investment.goalId || '',
        notes: investment.notes || '',
      });
    } else {
      resetForm();
    }
    setView('form');
  };

  const handleSubmitInvestment = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.initialAmount) return;

    const investmentData = {
      name: formData.name.trim(),
      type: formData.type,
      bank: formData.bank.trim(),
      initialAmount: formData.initialAmount,
      expectedReturn: formData.expectedReturn / 100, // Convert from percentage
      returnType: formData.returnType,
      purchaseDate: formData.purchaseDate || null,
      maturityDate: formData.maturityDate || null,
      goalId: formData.goalId || null,
      notes: formData.notes.trim(),
    };

    if (editingInvestment) {
      await updateInvestment(editingInvestment.id, investmentData);
    } else {
      await addInvestment(investmentData, true); // true = create transaction
    }

    resetForm();
    setView('list');
  };

  const handleDelete = async (investmentId) => {
    await deleteInvestment(investmentId);
    setConfirmDelete(null);
  };

  const handleOpenUpdateValue = (investment) => {
    setSelectedInvestmentForUpdate(investment);
    setNewCurrentValue(getCurrentValue(investment));
    setView('updateValue');
  };

  const handleUpdateValue = async () => {
    if (!selectedInvestmentForUpdate) return;
    await updateInvestment(selectedInvestmentForUpdate.id, {
      currentAmount: newCurrentValue
    });
    setSelectedInvestmentForUpdate(null);
    setNewCurrentValue(0);
    setView('list');
  };

  // Sort investments
  const getSortedInvestments = () => {
    const sorted = [...investments];

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'value':
        return sorted.sort((a, b) => getCurrentValue(b) - getCurrentValue(a));
      case 'type':
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      case 'maturity':
      default:
        return sorted.sort((a, b) => {
          if (!a.maturityDate && !b.maturityDate) return 0;
          if (!a.maturityDate) return 1;
          if (!b.maturityDate) return -1;
          return new Date(a.maturityDate) - new Date(b.maturityDate);
        });
    }
  };

  const InvestmentCard = ({ investment }) => {
    const typeInfo = getInvestmentType(investment.type);
    const color = getInvestmentColor(typeInfo.color);
    const currentValue = getCurrentValue(investment);
    const growthPercent = getGrowthPercentage(investment);
    const daysLeft = getDaysUntilMaturity(investment);
    const linkedGoal = investment.goalId ? goals.find(g => g.id === investment.goalId) : null;
    const taxes = calculateTaxes(investment);
    const isFixedIncome = investment.type === 'fixed_income' || investment.returnType === 'cdi';

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 ${color.light} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
            {typeInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{investment.name}</h3>
              <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${color.light} ${color.text}`}>
                {t(`investments.types.${investment.type}`)}
              </span>
            </div>
            {investment.bank && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{investment.bank}</p>
            )}

            {/* Values */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('investments.initialAmount')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(investment.initialAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('investments.currentAmount')}
                  {investment.returnType === 'cdi' && !investment.currentAmount && (
                    <span className="ml-1 text-blue-500 dark:text-blue-400">({t('investments.estimated')})</span>
                  )}
                </p>
                <p className={`font-medium ${color.text}`}>{formatCurrency(currentValue)}</p>
                {investment.returnType === 'cdi' && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {investment.expectedReturn * 100}% CDI
                  </p>
                )}
              </div>
            </div>

            {/* Growth & Maturity */}
            <div className="mt-3 flex items-center justify-between">
              <div className={`flex items-center gap-1 ${growthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                <span className="text-sm font-medium">
                  {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(2)}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({formatCurrency(currentValue - investment.initialAmount)})
                </span>
              </div>
              {daysLeft !== null && (
                <span className={`text-xs ${daysLeft < 0 ? 'text-rose-500 dark:text-rose-400' : daysLeft < 30 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {daysLeft < 0
                    ? t('investments.matured')
                    : t('investments.daysUntilMaturity', { days: daysLeft })}
                </span>
              )}
            </div>

            {/* Tax Breakdown (only for fixed income with profit) */}
            {isFixedIncome && taxes.grossProfit > 0 && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{t('investments.grossProfit')}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatCurrency(taxes.grossProfit)}
                  </span>
                </div>

                {taxes.iofAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      IOF ({(taxes.iofRate * 100).toFixed(0)}%)
                      <span className="ml-1 text-gray-400">• {taxes.daysHeld} {t('investments.days')}</span>
                    </span>
                    <span className="text-rose-500 dark:text-rose-400">
                      -{formatCurrency(taxes.iofAmount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    IR ({(taxes.irpfRate * 100).toFixed(1)}%)
                  </span>
                  <span className="text-rose-500 dark:text-rose-400">
                    -{formatCurrency(taxes.irpfAmount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t('investments.netValue')}
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(taxes.netValue)}
                  </span>
                </div>
              </div>
            )}

            {/* Linked Goal */}
            {linkedGoal && (
              <div className={`mt-2 px-3 py-2 rounded-lg ${getGoalColor(linkedGoal.color).light}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{GOAL_ICONS[linkedGoal.icon]}</span>
                  <span className={`text-sm font-medium ${getGoalColor(linkedGoal.color).text}`}>
                    {t('investments.linkedToGoal', { goal: linkedGoal.name })}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleOpenUpdateValue(investment)}
                className={`flex-1 py-2 ${color.bg} text-white text-sm font-medium rounded-lg hover:opacity-90 transition`}
              >
                {t('investments.updateValue')}
              </button>
              <button
                onClick={() => handleOpenForm(investment)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(investment.id)}
                className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete === investment.id && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-800">
            <p className="text-sm text-rose-800 dark:text-rose-200 font-medium">{t('investments.confirmDelete')}</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{t('investments.deleteWarning')}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDelete(investment.id)}
                className="flex-1 py-2 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 transition"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => {
                  setView('list');
                  resetForm();
                  setSelectedInvestmentForUpdate(null);
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {view === 'list' && t('investments.myInvestments')}
              {view === 'form' && (editingInvestment ? t('investments.editInvestment') : t('investments.newInvestment'))}
              {view === 'updateValue' && t('investments.updateValue')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* List View */}
          {view === 'list' && (
            <div className="space-y-3">
              {/* Portfolio Summary */}
              {investments.length > 0 && (
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-blue-100">{t('investments.totalInvested')}</p>
                      <p className="text-lg font-bold">{formatCurrency(getTotalInvested())}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-100">{t('investments.portfolioValue')}</p>
                      <p className="text-lg font-bold">{formatCurrency(getTotalCurrentValue())}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-100">{t('investments.growth')}</p>
                      <p className={`text-lg font-bold ${getTotalGrowth() >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {getTotalGrowth() >= 0 ? '+' : ''}{formatCurrency(getTotalGrowth())}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-gray-500 mx-auto" />
                  <p className="mt-3 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                </div>
              ) : investments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📈</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">{t('investments.noInvestments')}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('investments.noInvestmentsSubtitle')}</p>
                </div>
              ) : (
                <>
                  {/* Sort Dropdown */}
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('investments.sortBy')}:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-xs pl-2 pr-8 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="maturity">{t('investments.sortByMaturity')}</option>
                      <option value="name">{t('investments.sortByName')}</option>
                      <option value="value">{t('investments.sortByValue')}</option>
                      <option value="type">{t('investments.sortByType')}</option>
                    </select>
                  </div>

                  {/* Investments List */}
                  {getSortedInvestments().map((investment) => (
                    <InvestmentCard key={investment.id} investment={investment} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Form View */}
          {view === 'form' && (
            <form onSubmit={handleSubmitInvestment} className="space-y-5">
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
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  placeholder={t('investments.namePlaceholder')}
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.type')}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: key })}
                      className={`p-3 text-xl rounded-xl border-2 transition flex flex-col items-center gap-1 ${
                        formData.type === key
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
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
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  placeholder={t('investments.bankPlaceholder')}
                />
              </div>

              {/* Initial Amount (only for new investments) */}
              {!editingInvestment && (
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
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                />
              </div>

              {/* Expected Return */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.returnType')}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['cdi', 'annual', 'monthly', 'total'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, returnType: type })}
                        className={`px-3 py-2.5 text-sm font-medium rounded-xl border-2 transition ${
                          formData.returnType === type
                            ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        {t(`investments.returnTypes.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {formData.returnType === 'cdi' ? t('investments.cdiPercentage') : t('investments.expectedReturn')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.expectedReturn}
                      onChange={(e) => setFormData({ ...formData, expectedReturn: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                        text-gray-900 dark:text-white placeholder-gray-400
                        focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition pr-24"
                      placeholder={formData.returnType === 'cdi' ? '100' : '0.00'}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {formData.returnType === 'cdi' ? '% CDI' : '%'}
                    </span>
                  </div>
                  {formData.returnType === 'cdi' && (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('investments.cdiHint')} ({t('investments.currentCdi')}: {(CDI_ANNUAL_RATE * 100).toFixed(2)}% {t('investments.returnTypes.annual').toLowerCase()})
                    </p>
                  )}
                </div>
              </div>

              {/* Maturity Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.maturityDate')}
                </label>
                <input
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                />
              </div>

              {/* Link to Goal */}
              {availableGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.linkToGoal')}
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* No goal option */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, goalId: '' })}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        !formData.goalId
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('investments.noGoalSelected')}</span>
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
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            formData.goalId === goal.id
                              ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <div className={`w-8 h-8 ${color.light} rounded-lg flex items-center justify-center text-base`}>
                            {icon}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                    text-gray-900 dark:text-white placeholder-gray-400
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition resize-none"
                  placeholder={t('investments.notesPlaceholder')}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!formData.name.trim() || (!editingInvestment && !formData.initialAmount)}
                className="w-full py-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                  hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingInvestment ? t('common.save') : t('investments.addInvestment')}
              </button>
            </form>
          )}

          {/* Update Value View */}
          {view === 'updateValue' && selectedInvestmentForUpdate && (
            <div className="space-y-5">
              {/* Investment Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${getInvestmentColor(getInvestmentType(selectedInvestmentForUpdate.type).color).light} rounded-xl flex items-center justify-center text-2xl`}>
                    {getInvestmentType(selectedInvestmentForUpdate.type).icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{selectedInvestmentForUpdate.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('investments.initialAmount')}: {formatCurrency(selectedInvestmentForUpdate.initialAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Value Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('investments.currentAmount')}
                </label>
                <CurrencyInput
                  value={newCurrentValue}
                  onChange={setNewCurrentValue}
                />
              </div>

              {/* Preview new growth */}
              {newCurrentValue > 0 && (
                <div className={`p-4 rounded-xl border ${
                  newCurrentValue >= selectedInvestmentForUpdate.initialAmount
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800'
                }`}>
                  <p className={`text-sm ${newCurrentValue >= selectedInvestmentForUpdate.initialAmount ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    <span className="font-medium">{t('investments.growth')}:</span>{' '}
                    {((newCurrentValue - selectedInvestmentForUpdate.initialAmount) / selectedInvestmentForUpdate.initialAmount * 100).toFixed(2)}%
                  </p>
                  <p className={`text-sm mt-1 ${newCurrentValue >= selectedInvestmentForUpdate.initialAmount ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    <span className="font-medium">
                      {newCurrentValue >= selectedInvestmentForUpdate.initialAmount ? '+' : ''}
                      {formatCurrency(newCurrentValue - selectedInvestmentForUpdate.initialAmount)}
                    </span>
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleUpdateValue}
                disabled={!newCurrentValue || newCurrentValue <= 0}
                className="w-full py-3.5 bg-blue-500 text-white font-medium rounded-xl
                  hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('investments.updateValue')}
              </button>
            </div>
          )}
        </div>

        {/* Footer - Add button for list view */}
        {view === 'list' && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => handleOpenForm()}
              className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('investments.addInvestment')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
