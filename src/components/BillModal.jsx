import { useState, useEffect } from 'react';
import { NumericFormat } from 'react-number-format';
import { useBills } from '../contexts/BillsContext';
import { useSettings } from '../contexts/SettingsContext';

export default function BillModal({ isOpen, onClose, bill = null }) {
  const { addBill, updateBill, deleteBill } = useBills();
  const { t, language, categories } = useSettings();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    category: '',
    dueDate: '',
    recurrence: 'none', // none, monthly, weekly, yearly
    recurrenceEndDate: '', // empty means repeat forever
    notificationEnabled: true,
    notificationDaysBefore: 3 // days before due date to send reminder
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (bill) {
      setFormData({
        name: bill.name || '',
        description: bill.description || '',
        amount: bill.amount ? String(bill.amount) : '',
        category: bill.category || '',
        dueDate: bill.dueDate?.split('T')[0] || '',
        recurrence: bill.recurrence || 'none',
        recurrenceEndDate: bill.recurrenceEndDate?.split('T')[0] || '',
        notificationEnabled: bill.notificationEnabled !== false,
        notificationDaysBefore: bill.notificationDaysBefore || 3
      });
    } else {
      // Reset form for new bill
      setFormData({
        name: '',
        description: '',
        amount: '',
        category: '',
        dueDate: '',
        recurrence: 'none',
        recurrenceEndDate: '',
        notificationEnabled: true,
        notificationDaysBefore: 3
      });
    }
    setErrors({});
    setConfirmDelete(false);
  }, [bill, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = language === 'pt' ? 'Nome obrigatório' : 'Name required';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = language === 'pt' ? 'Data de vencimento obrigatória' : 'Due date required';
    }

    if (!formData.category) {
      newErrors.category = language === 'pt' ? 'Categoria obrigatória' : 'Category required';
    }

    if (formData.recurrence !== 'none' && formData.recurrenceEndDate) {
      const dueDate = new Date(formData.dueDate);
      const endDate = new Date(formData.recurrenceEndDate);
      if (endDate <= dueDate) {
        newErrors.recurrenceEndDate = language === 'pt'
          ? 'Data final deve ser posterior à data de vencimento'
          : 'End date must be after due date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);

    try {
      const billData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        dueDate: new Date(formData.dueDate).toISOString(),
        category: formData.category,
        amount: formData.amount ? parseFloat(formData.amount) : 0,
        recurrence: formData.recurrence,
        recurrenceEndDate: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
        notificationEnabled: formData.notificationEnabled,
        notificationDaysBefore: parseInt(formData.notificationDaysBefore),
        postponeCount: bill?.postponeCount || 0
      };

      let result;
      if (bill) {
        result = await updateBill(bill.id, billData);
      } else {
        result = await addBill(billData);
      }

      if (result.success) {
        onClose();
      } else {
        setErrors({ submit: result.error });
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      setErrors({ submit: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bill) return;

    setSaving(true);
    try {
      const result = await deleteBill(bill.id);
      if (result.success) {
        onClose();
      } else {
        setErrors({ submit: result.error });
      }
    } catch (error) {
      console.error('Error deleting bill:', error);
      setErrors({ submit: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const expenseCategories = categories.expense || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90dvh] overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {bill ? (language === 'pt' ? 'Editar Conta' : 'Edit Bill') : (language === 'pt' ? 'Nova Conta' : 'New Bill')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bill-modal-form p-4 sm:p-6 landscape:p-3 overflow-y-auto max-h-[calc(90dvh-140px)]">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Nome da Conta' : 'Bill Name'} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={language === 'pt' ? 'Ex: Conta de Luz' : 'Ex: Electricity Bill'}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  ${errors.name ? 'border-rose-500' : 'border-gray-200 dark:border-gray-600'}`}
              />
              {errors.name && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.name}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Valor' : 'Amount'}
                <span className="text-gray-400 text-xs ml-1">({language === 'pt' ? 'opcional' : 'optional'})</span>
              </label>
              <NumericFormat
                value={formData.amount}
                onValueChange={(vals) => setFormData({ ...formData, amount: vals.floatValue ?? '' })}
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={2}
                fixedDecimalScale
                prefix="R$ "
                placeholder="R$ 0,00"
                allowNegative={false}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Descrição' : 'Description'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={language === 'pt' ? 'Informações adicionais (opcional)' : 'Additional information (optional)'}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('charts.category')} *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  ${errors.category ? 'border-rose-500' : 'border-gray-200 dark:border-gray-600'}`}
              >
                <option value="">{language === 'pt' ? 'Selecione...' : 'Select...'}</option>
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.category}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Data de Vencimento' : 'Due Date'} *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    ${errors.dueDate ? 'border-rose-500' : 'border-gray-200 dark:border-gray-600'}`}
                />
                {errors.dueDate && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.dueDate}</p>}
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Recorrência' : 'Recurrence'}
                </label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">{language === 'pt' ? 'Sem recorrência' : 'No recurrence'}</option>
                  <option value="monthly">{language === 'pt' ? 'Mensal' : 'Monthly'}</option>
                  <option value="weekly">{language === 'pt' ? 'Semanal' : 'Weekly'}</option>
                  <option value="yearly">{language === 'pt' ? 'Anual' : 'Yearly'}</option>
                </select>
              </div>
            </div>

            {/* Recurrence End Date (only show if recurrence is set) */}
            {formData.recurrence !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Repetir até (opcional)' : 'Repeat until (optional)'}
                </label>
                <input
                  type="date"
                  value={formData.recurrenceEndDate}
                  onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    ${errors.recurrenceEndDate ? 'border-rose-500' : 'border-gray-200 dark:border-gray-600'}`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'pt' ? 'Deixe em branco para repetir indefinidamente' : 'Leave blank to repeat forever'}
                </p>
                {errors.recurrenceEndDate && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.recurrenceEndDate}</p>}
              </div>
            )}

            {formData.recurrence !== 'none' && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {language === 'pt'
                  ? 'A conta será gerada automaticamente a cada período até a data de encerramento.'
                  : 'A bill will be created automatically each period until the end date.'}
              </p>
            )}

            {/* Notification Settings */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {language === 'pt' ? 'Notificações' : 'Notifications'}
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notificationEnabled: !formData.notificationEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.notificationEnabled ? 'bg-rose-500' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formData.notificationEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'pt' ? 'Lembrar quantos dias antes?' : 'Remind how many days before?'}
                  </label>
                  <select
                    value={formData.notificationDaysBefore}
                    onChange={(e) => setFormData({ ...formData, notificationDaysBefore: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="1">{language === 'pt' ? '1 dia antes' : '1 day before'}</option>
                    <option value="2">{language === 'pt' ? '2 dias antes' : '2 days before'}</option>
                    <option value="3">{language === 'pt' ? '3 dias antes' : '3 days before'}</option>
                    <option value="5">{language === 'pt' ? '5 dias antes' : '5 days before'}</option>
                    <option value="7">{language === 'pt' ? '7 dias antes' : '7 days before'}</option>
                  </select>
                </div>
              )}
            </div>

            {errors.submit && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-sm text-rose-600 dark:text-rose-400">{errors.submit}</p>
              </div>
            )}
          </div>
        </form>

        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700">
          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-700 dark:text-gray-300 font-medium">
                {language === 'pt' ? 'Tem certeza que deseja excluir esta conta?' : 'Are you sure you want to delete this bill?'}
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
                  onClick={handleDelete}
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
              {bill && (
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
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 disabled:opacity-50 transition"
              >
                {saving ? (
                  <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  bill ? t('common.save') : (language === 'pt' ? 'Criar Conta' : 'Create Bill')
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (orientation: landscape) and (max-height: 500px) {
          .bill-modal-form > div > div {
            margin-bottom: 0.5rem;
          }
          .bill-modal-form label {
            margin-bottom: 0.125rem !important;
          }
        }
      `}</style>
    </div>
  );
}
