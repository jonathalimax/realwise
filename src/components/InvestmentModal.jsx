import { useState, useEffect } from 'react';
import { useInvestments, INVESTMENT_TYPES, CDI_ANNUAL_RATE } from '../contexts/InvestmentContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import CurrencyInput from './ui/CurrencyInput';

export default function InvestmentModal({ isOpen, onClose, initialView = 'form', editingInvestment: externalEditingInvestment = null }) {
  const {
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

  const [view, setView] = useState(initialView); // 'form', 'updateValue', 'withdraw'
  const [editingInvestment, setEditingInvestment] = useState(externalEditingInvestment);
  const [selectedInvestmentForUpdate, setSelectedInvestmentForUpdate] = useState(null);
  const [newCurrentValue, setNewCurrentValue] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Withdraw state
  const [selectedInvestmentForWithdraw, setSelectedInvestmentForWithdraw] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [isFullWithdrawal, setIsFullWithdrawal] = useState(false);
  const [withdrawGoalId, setWithdrawGoalId] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

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

  // Handle external editing investment or withdraw
  useEffect(() => {
    if (externalEditingInvestment && isOpen) {
      if (initialView === 'withdraw') {
        // Initialize withdraw view
        setSelectedInvestmentForWithdraw(externalEditingInvestment);
        const currentValue = getCurrentValue(externalEditingInvestment);
        setWithdrawAmount(currentValue);
        setIsFullWithdrawal(true);
        setWithdrawGoalId('');
        setView('withdraw');
      } else {
        handleOpenForm(externalEditingInvestment);
      }
    }
  }, [externalEditingInvestment, isOpen, initialView]);

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
      const success = await updateInvestment(editingInvestment.id, investmentData);
      if (!success) {
        alert(language === 'pt' ? 'Erro ao atualizar investimento. Tente novamente.' : 'Error updating investment. Please try again.');
        return;
      }
    } else {
      await addInvestment(investmentData, true); // true = create transaction
    }

    resetForm();
    onClose();
  };

  const handleDelete = async (investmentId) => {
    await deleteInvestment(investmentId);
    setConfirmDelete(null);
    onClose();
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
    onClose();
  };

  // Withdraw handlers
  const handleOpenWithdraw = (investment) => {
    setSelectedInvestmentForWithdraw(investment);
    const currentValue = getCurrentValue(investment);
    setWithdrawAmount(currentValue);
    setIsFullWithdrawal(true);
    setWithdrawGoalId('');
    setWithdrawDate(new Date().toISOString().split('T')[0]);
    setView('withdraw');
  };

  const handleWithdraw = async () => {
    if (!selectedInvestmentForWithdraw || withdrawAmount <= 0) return;

    setIsWithdrawing(true);
    try {
      const result = await withdrawFromInvestment(
        selectedInvestmentForWithdraw.id,
        withdrawAmount,
        { goalId: withdrawGoalId || null, createTransaction: true, withdrawDate: withdrawDate || new Date().toISOString().split('T')[0] }
      );

      if (result.success) {
        setSelectedInvestmentForWithdraw(null);
        setWithdrawAmount(0);
        setIsFullWithdrawal(false);
        setWithdrawGoalId('');
        setWithdrawDate(new Date().toISOString().split('T')[0]);
        onClose();
      } else {
        alert(language === 'pt' ? 'Erro ao realizar resgate. Tente novamente.' : 'Error withdrawing. Please try again.');
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleFullWithdrawalToggle = (checked) => {
    setIsFullWithdrawal(checked);
    if (checked && selectedInvestmentForWithdraw) {
      setWithdrawAmount(getCurrentValue(selectedInvestmentForWithdraw));
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {view === 'form' && (editingInvestment ? t('investments.editInvestment') : t('investments.newInvestment'))}
            {view === 'updateValue' && t('investments.updateValue')}
            {view === 'withdraw' && t('investments.withdraw')}
          </h2>
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
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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
                      <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 w-full text-center leading-tight px-0.5 line-clamp-2">
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

              {/* Submit and Delete buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={!formData.name.trim() || (!editingInvestment && !formData.initialAmount)}
                  className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-xl
                    hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingInvestment ? t('common.save') : t('investments.addInvestment')}
                </button>

                {/* Delete button (only when editing) */}
                {editingInvestment && (
                  confirmDelete === editingInvestment.id ? (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100 dark:border-red-800">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium">{t('investments.confirmDelete')}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t('investments.deleteWarning')}</p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            handleDelete(editingInvestment.id);
                            setView('list');
                            resetForm();
                          }}
                          className="flex-1 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition"
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(editingInvestment.id)}
                      className="w-full py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl border border-red-200 dark:border-red-800
                        hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                    >
                      {t('common.delete')} {t('investments.title').slice(0, -1)}
                    </button>
                  )
                )}
              </div>
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
                className="w-full py-3 bg-blue-500 text-white text-sm font-medium rounded-xl
                  hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('investments.updateValue')}
              </button>
            </div>
          )}

          {/* Withdraw View */}
          {view === 'withdraw' && selectedInvestmentForWithdraw && (
            <div className="space-y-5">
              {/* Investment Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${getInvestmentColor(getInvestmentType(selectedInvestmentForWithdraw.type).color).light} rounded-xl flex items-center justify-center text-2xl`}>
                    {getInvestmentType(selectedInvestmentForWithdraw.type).icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{selectedInvestmentForWithdraw.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('investments.currentAmount')}: {formatCurrency(getCurrentValue(selectedInvestmentForWithdraw))}
                    </p>
                  </div>
                </div>
              </div>

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
                  {withdrawAmount > getCurrentValue(selectedInvestmentForWithdraw) && (
                    <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">
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
                    focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                />
              </div>

              {/* Tax Preview for Fixed Income */}
              {(() => {
                const taxes = calculateTaxes(selectedInvestmentForWithdraw);
                const isFixedIncome = selectedInvestmentForWithdraw.type === 'fixed_income' || selectedInvestmentForWithdraw.returnType === 'cdi';
                if (!isFixedIncome || taxes.grossProfit <= 0) return null;

                const withdrawRatio = withdrawAmount / getCurrentValue(selectedInvestmentForWithdraw);
                const estimatedTaxes = taxes.totalTaxes * withdrawRatio;

                return (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-xl">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                      {language === 'pt' ? 'Impostos estimados no resgate:' : 'Estimated taxes on withdrawal:'}
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      IOF + IR: ~{formatCurrency(estimatedTaxes)}
                    </p>
                  </div>
                );
              })()}

              {/* Goal Selector */}
              {availableGoals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('investments.contributeToGoal')}
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* No goal option */}
                    <button
                      type="button"
                      onClick={() => setWithdrawGoalId('')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        !withdrawGoalId
                          ? 'border-gray-900 dark:border-gray-400 bg-gray-50 dark:bg-gray-700'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t('investments.noGoal')}</span>
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
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            withdrawGoalId === goal.id
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

              {/* Submit */}
              <button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > getCurrentValue(selectedInvestmentForWithdraw) || isWithdrawing}
                className="w-full py-3 bg-emerald-500 text-white text-sm font-medium rounded-xl
                  hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWithdrawing
                  ? (language === 'pt' ? 'Processando...' : 'Processing...')
                  : t('investments.confirmWithdraw')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
