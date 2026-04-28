import { useState } from 'react';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useSettings } from '../contexts/SettingsContext';
import PageHeader from '../components/PageHeader';

export default function CardsPage() {
  const { userBanks, loading, addBank, updateBank, deleteBank, getBankInfo, getBankColor, getBankDisplayName } = useCards();
  const { t, language } = useSettings();

  const [view, setView] = useState('list'); // 'list', 'form'
  const [editingBank, setEditingBank] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bankId: 'nubank',
    cardName: '',
    customBankName: '',
    hasCredit: true,
    closingDay: 10,
    paymentDay: 15
  });

  const resetForm = () => {
    setFormData({
      bankId: 'nubank',
      cardName: '',
      customBankName: '',
      hasCredit: true,
      closingDay: 10,
      paymentDay: 15
    });
    setEditingBank(null);
  };

  const handleOpenForm = (userBank = null) => {
    if (userBank) {
      setEditingBank(userBank);
      setFormData({
        bankId: userBank.bankId,
        cardName: userBank.cardName || '',
        customBankName: userBank.customBankName || '',
        hasCredit: userBank.hasCredit || false,
        closingDay: userBank.closingDay || 10,
        paymentDay: userBank.paymentDay || 15
      });
      setShowEditModal(true);
    } else {
      resetForm();
      setView('form');
    }
  };

  const handleSubmitBank = async (e) => {
    e.preventDefault();

    const bankData = {
      bankId: formData.bankId,
      cardName: formData.cardName,
      customBankName: formData.bankId === 'other' ? formData.customBankName : null,
      hasCredit: formData.hasCredit,
      closingDay: formData.hasCredit ? parseInt(formData.closingDay) : null,
      paymentDay: formData.hasCredit ? parseInt(formData.paymentDay) : null
    };

    if (editingBank) {
      await updateBank(editingBank.id, bankData);
      setShowEditModal(false);
    } else {
      await addBank(bankData);
      setView('list');
    }

    resetForm();
  };

  const handleDelete = async (docId) => {
    await deleteBank(docId);
    setShowEditModal(false);
    resetForm();
  };

  // Get custom bank names for suggestions
  const customBankNames = userBanks
    .filter(ub => ub.bankId === 'other' && ub.customBankName)
    .map(ub => ub.customBankName);

  const BankItem = ({ userBank }) => {
    const bankInfo = getBankInfo(userBank.bankId);
    const color = getBankColor(userBank.bankId);
    const displayName = getBankDisplayName(userBank);
    const subtitleName = userBank.bankId === 'other' && userBank.customBankName ? userBank.customBankName : bankInfo.name;

    return (
      <div
        onClick={() => handleOpenForm(userBank)}
        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${color.light} dark:bg-opacity-30 rounded-lg flex items-center justify-center text-xl flex-shrink-0`}>
            {bankInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">{displayName}</h3>
              {userBank.hasCredit ? (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  {language === 'pt' ? 'Crédito' : 'Credit'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {language === 'pt' ? 'Conta' : 'Account'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{subtitleName}</span>
              {userBank.hasCredit && (
                <>
                  <span>•</span>
                  <span>{t('cards.closingDay')}: {userBank.closingDay}</span>
                  <span>•</span>
                  <span>{t('cards.paymentDay')}: {userBank.paymentDay}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  // Generate day options (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  // Edit Bank Modal Component
  const EditBankModal = () => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!showEditModal || !editingBank) return null;

    const handleModalSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      await handleSubmitBank(e);
      setSaving(false);
    };

    const handleModalDelete = async () => {
      setSaving(true);
      await handleDelete(editingBank.id);
      setSaving(false);
      setConfirmDelete(false);
    };

    const handleCloseModal = () => {
      setShowEditModal(false);
      resetForm();
      setConfirmDelete(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {language === 'pt' ? 'Editar Banco' : 'Edit Bank'}
            </h2>
            <button
              onClick={handleCloseModal}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleModalSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="space-y-5">
              {/* Bank Selection (Disabled when editing) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Banco' : 'Bank'}
                </label>
                <select
                  value={formData.bankId}
                  disabled={true}
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white opacity-50 cursor-not-allowed"
                >
                  {BANKS.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.icon} {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Bank Name - shown when "Outro" is selected */}
              {formData.bankId === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Nome do Banco' : 'Bank Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.customBankName}
                    onChange={(e) => setFormData({ ...formData, customBankName: e.target.value })}
                    list="custom-bank-names-modal"
                    placeholder={language === 'pt' ? 'Ex: Banco XYZ' : 'Ex: XYZ Bank'}
                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                      text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  />
                  {customBankNames.length > 0 && (
                    <datalist id="custom-bank-names-modal">
                      {customBankNames.map((name, idx) => (
                        <option key={idx} value={name} />
                      ))}
                    </datalist>
                  )}
                </div>
              )}

              {/* Card Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Nome do Cartão' : 'Card Name'}
                </label>
                <input
                  type="text"
                  value={formData.cardName}
                  onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                  placeholder={language === 'pt' ? 'Ex: Cartão Pessoal' : 'Ex: Personal Card'}
                  className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                />
              </div>

              {/* Has Credit Card Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasCredit: !formData.hasCredit })}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    formData.hasCredit
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">💳</span>
                    <div className="text-left">
                      <span className={`font-medium ${formData.hasCredit ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {language === 'pt' ? 'Cartão de Crédito' : 'Credit Card'}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'pt' ? 'Configurar fechamento e vencimento' : 'Configure closing and payment dates'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-14 h-8 rounded-full transition-colors flex items-center px-1.5 ${
                    formData.hasCredit ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.hasCredit ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              </div>

              {/* Credit Card Settings */}
              {formData.hasCredit && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl space-y-4">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    {language === 'pt' ? 'Configurações da Fatura' : 'Invoice Settings'}
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Closing Day */}
                    <div>
                      <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                        {t('cards.closingDay')}
                      </label>
                      <select
                        value={formData.closingDay}
                        onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) })}
                        className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                          text-gray-900 dark:text-white
                          focus:border-purple-500 focus:ring-0 focus:outline-none"
                      >
                        {dayOptions.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>

                    {/* Payment Day */}
                    <div>
                      <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                        {t('cards.paymentDay')}
                      </label>
                      <select
                        value={formData.paymentDay}
                        onChange={(e) => setFormData({ ...formData, paymentDay: parseInt(e.target.value) })}
                        className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                          text-gray-900 dark:text-white
                          focus:border-purple-500 focus:ring-0 focus:outline-none"
                      >
                        {dayOptions.map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>

          <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700">
            {confirmDelete ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-gray-700 dark:text-gray-300 font-medium">
                  {language === 'pt' ? 'Tem certeza que deseja excluir este banco?' : 'Are you sure you want to delete this bank?'}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleModalDelete}
                    disabled={saving}
                    className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 disabled:opacity-50 transition"
                  >
                    {saving ? (
                      <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      t('common.delete')
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-2.5 border border-rose-300 dark:border-rose-600 text-rose-600 dark:text-rose-400 rounded-xl font-medium hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                  title={t('common.delete')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    t('common.save')
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title={
          view === 'list'
            ? (language === 'pt' ? 'Meus Bancos' : 'My Banks')
            : editingBank
              ? (language === 'pt' ? 'Editar Banco' : 'Edit Bank')
              : (language === 'pt' ? 'Adicionar Banco' : 'Add Bank')
        }
        showMonth={false}
        right={view === 'form' ? (
          <button
            onClick={() => { setView('list'); resetForm(); }}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* List View */}
        {view === 'list' && (
          <div className="space-y-2">
            {/* Cash / No Bank - Always shown first */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl">
                  💵
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    {language === 'pt' ? 'Dinheiro' : 'Cash'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {language === 'pt' ? 'Transações sem banco vinculado' : 'Transactions without bank'}
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto" />
                <p className="mt-3 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              </div>
            ) : userBanks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  {language === 'pt' ? 'Nenhum banco adicionado' : 'No banks added'}
                </p>
              </div>
            ) : (
              userBanks.map((userBank) => <BankItem key={userBank.id} userBank={userBank} />)
            )}
          </div>
        )}

        {/* Form View */}
        {view === 'form' && (
          <form onSubmit={handleSubmitBank} className="space-y-5">
            {/* Bank Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Banco' : 'Bank'}
              </label>
              <select
                value={formData.bankId}
                onChange={(e) => setFormData({ ...formData, bankId: e.target.value, customBankName: '' })}
                disabled={!!editingBank}
                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                  text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {BANKS.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.icon} {bank.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Bank Name - shown when "Outro" is selected */}
            {formData.bankId === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Nome do Banco' : 'Bank Name'}
                </label>
                <input
                  type="text"
                  value={formData.customBankName}
                  onChange={(e) => setFormData({ ...formData, customBankName: e.target.value })}
                  list="custom-bank-names"
                  placeholder={language === 'pt' ? 'Ex: Banco XYZ' : 'Ex: XYZ Bank'}
                  className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                />
                {customBankNames.length > 0 && (
                  <datalist id="custom-bank-names">
                    {customBankNames.map((name, idx) => (
                      <option key={idx} value={name} />
                    ))}
                  </datalist>
                )}
                {customBankNames.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {language === 'pt' ? 'Sugestões dos bancos que você já adicionou' : 'Suggestions from banks you already added'}
                  </p>
                )}
              </div>
            )}

            {/* Card Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Nome do Cartão' : 'Card Name'}
              </label>
              <input
                type="text"
                value={formData.cardName}
                onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                placeholder={language === 'pt' ? 'Ex: Cartão Pessoal' : 'Ex: Personal Card'}
                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                  text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
              />
            </div>

            {/* Has Credit Card Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, hasCredit: !formData.hasCredit })}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  formData.hasCredit
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div className="text-left">
                    <span className={`font-medium ${formData.hasCredit ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {language === 'pt' ? 'Cartão de Crédito' : 'Credit Card'}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'pt' ? 'Configurar fechamento e vencimento' : 'Configure closing and payment dates'}
                    </p>
                  </div>
                </div>
                <div className={`w-14 h-8 rounded-full transition-colors flex items-center px-1.5 ${
                  formData.hasCredit ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    formData.hasCredit ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            </div>

            {/* Credit Card Settings */}
            {formData.hasCredit && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl space-y-4">
                <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  {language === 'pt' ? 'Configurações da Fatura' : 'Invoice Settings'}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Closing Day */}
                  <div>
                    <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                      {t('cards.closingDay')}
                    </label>
                    <select
                      value={formData.closingDay}
                      onChange={(e) => setFormData({ ...formData, closingDay: parseInt(e.target.value) })}
                      className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                        text-gray-900 dark:text-white
                        focus:border-purple-500 focus:ring-0 focus:outline-none"
                    >
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Day */}
                  <div>
                    <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                      {t('cards.paymentDay')}
                    </label>
                    <select
                      value={formData.paymentDay}
                      onChange={(e) => setFormData({ ...formData, paymentDay: parseInt(e.target.value) })}
                      className="w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-700 rounded-lg
                        text-gray-900 dark:text-white
                        focus:border-purple-500 focus:ring-0 focus:outline-none"
                    >
                      {dayOptions.map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                hover:bg-gray-800 dark:hover:bg-gray-200 transition"
            >
              {editingBank
                ? t('common.save')
                : (language === 'pt' ? 'Adicionar Banco' : 'Add Bank')}
            </button>
          </form>
        )}
      </div>

      {/* Edit Bank Modal */}
      <EditBankModal />

      {/* FAB — only on list view */}
      {view === 'list' && (
        <button
          onClick={() => handleOpenForm()}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label={language === 'pt' ? 'Adicionar Banco' : 'Add Bank'}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
