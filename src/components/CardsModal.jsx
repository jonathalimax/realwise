import { useState } from 'react';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useSettings } from '../contexts/SettingsContext';

export default function CardsModal({ isOpen, onClose }) {
  const { userBanks, loading, addBank, updateBank, deleteBank, getBankInfo, getBankColor, migrateCardIdToBankId, createBillsForExistingCreditCards } = useCards();
  const { t, language } = useSettings();

  const [view, setView] = useState('list'); // 'list', 'form'
  const [editingBank, setEditingBank] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [billCreationStatus, setBillCreationStatus] = useState(null);
  const [creatingBills, setCreatingBills] = useState(false);

  const handleCreateBillsForCards = async () => {
    setCreatingBills(true);
    setBillCreationStatus(null);
    try {
      const result = await createBillsForExistingCreditCards();
      setBillCreationStatus(result);
    } catch (error) {
      setBillCreationStatus({ success: false, error: error.message, created: 0 });
    } finally {
      setCreatingBills(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationStatus(null);
    try {
      const result = await migrateCardIdToBankId();
      setMigrationStatus(result);
    } catch (error) {
      setMigrationStatus({ success: false, error: error.message });
    } finally {
      setMigrating(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    bankId: 'nubank',
    cardName: '',
    customBankName: '',
    hasCredit: true,
    closingDay: 10,
    paymentDay: 15
  });

  if (!isOpen) return null;

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
    } else {
      resetForm();
    }
    setView('form');
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
    } else {
      await addBank(bankData);
    }

    resetForm();
    setView('list');
  };

  const handleDelete = async (docId) => {
    await deleteBank(docId);
    setConfirmDelete(null);
  };

  // Get available banks (not yet added)
  const availableBanks = BANKS;

  const BankItem = ({ userBank }) => {
    const bankInfo = getBankInfo(userBank.bankId);
    const color = getBankColor(userBank.bankId);
    // Display name: custom bank name (for "other") or card name or default bank name
    const displayName = userBank.cardName || (userBank.bankId === 'other' && userBank.customBankName) || bankInfo.name;
    const subtitleName = userBank.bankId === 'other' && userBank.customBankName ? userBank.customBankName : bankInfo.name;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 ${color.light} dark:bg-opacity-30 rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
            {bankInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">{displayName}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitleName}</p>

            {userBank.hasCredit ? (
              <div className="mt-1.5">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  {language === 'pt' ? 'Cartao de Crédito' : 'Credit Card'}
                </span>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{t('cards.closingDay')}: {userBank.closingDay}</span>
                  <span className="mx-2">|</span>
                  <span>{t('cards.paymentDay')}: {userBank.paymentDay}</span>
                </div>
              </div>
            ) : (
              <span className="mt-1.5 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {language === 'pt' ? 'Conta Corrente' : 'Bank Account'}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleOpenForm(userBank)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(userBank.id)}
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
        {confirmDelete === userBank.id && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-800">
            <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
              {language === 'pt' ? 'Remover este banco?' : 'Remove this bank?'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDelete(userBank.id)}
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

  // Generate day options (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

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
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {view === 'list' && (language === 'pt' ? 'Meus Bancos' : 'My Banks')}
              {view === 'form' && (editingBank
                ? (language === 'pt' ? 'Editar Banco' : 'Edit Bank')
                : (language === 'pt' ? 'Adicionar Banco' : 'Add Bank'))}
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
              {/* Cash / No Bank - Always shown first */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-2xl">
                    💵
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {language === 'pt' ? 'Dinheiro' : 'Cash'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
                  {availableBanks.map(bank => (
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
                    placeholder={language === 'pt' ? 'Ex: Banco XYZ' : 'Ex: XYZ Bank'}
                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                      text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                  />
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

        {/* Footer - Add button for list view */}
        {view === 'list' && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 space-y-3">
            {availableBanks.length > 0 && (
              <button
                onClick={() => handleOpenForm()}
                className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                  hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {language === 'pt' ? 'Adicionar Banco' : 'Add Bank'}
              </button>
            )}

            {/* Create bills for credit cards button */}
            {userBanks.filter(b => b.hasCredit).length > 0 && (
              <button
                onClick={handleCreateBillsForCards}
                disabled={creatingBills}
                className="w-full py-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-xl
                  hover:bg-purple-200 dark:hover:bg-purple-900/60 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {creatingBills ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700 dark:border-purple-300" />
                    {language === 'pt' ? 'Criando contas...' : 'Creating bills...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {language === 'pt' ? 'Criar contas para cartões' : 'Create bills for cards'}
                  </>
                )}
              </button>
            )}

            {/* Bill creation status */}
            {billCreationStatus && (
              <div className={`p-3 rounded-xl text-sm ${
                billCreationStatus.success
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
              }`}>
                {billCreationStatus.success
                  ? (language === 'pt'
                      ? billCreationStatus.created > 0
                        ? `${billCreationStatus.created} conta(s) criada(s) para seus cartões!`
                        : 'Todos os cartões já possuem contas.'
                      : billCreationStatus.created > 0
                        ? `${billCreationStatus.created} bill(s) created for your cards!`
                        : 'All cards already have bills.')
                  : (language === 'pt'
                      ? `Erro: ${billCreationStatus.error}`
                      : `Error: ${billCreationStatus.error}`)}
              </div>
            )}

            {/* Migration button */}
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="w-full py-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-xl
                hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {migrating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700 dark:border-amber-300" />
                  {language === 'pt' ? 'Migrando...' : 'Migrating...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {language === 'pt' ? 'Migrar dados antigos' : 'Migrate old data'}
                </>
              )}
            </button>

            {/* Migration status */}
            {migrationStatus && (
              <div className={`p-3 rounded-xl text-sm ${
                migrationStatus.success
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
              }`}>
                {migrationStatus.success
                  ? (language === 'pt'
                      ? `Migração concluída! ${migrationStatus.migratedCount} transações atualizadas.`
                      : `Migration complete! ${migrationStatus.migratedCount} transactions updated.`)
                  : (language === 'pt'
                      ? `Erro: ${migrationStatus.error}`
                      : `Error: ${migrationStatus.error}`)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
