import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';
import {
  ChatBubbleBottomCenterTextIcon,
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

export default function NotificationsPage() {
  const { language } = useSettings();
  const { bills } = useBills();

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', auth.currentUser.uid));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.whatsappNumber) {
          setWhatsappNumber(data.whatsappNumber);
        } else if (data.whatsappNumbers && data.whatsappNumbers.length > 0) {
          setWhatsappNumber(data.whatsappNumbers[0]);
        }
        setNotificationsEnabled(data.whatsappNotificationsEnabled !== false);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveNumber = async () => {
    let number = whatsappNumber.trim();

    if (!number) {
      await saveSettings('', notificationsEnabled);
      return;
    }

    number = number.replace(/[\s\-()]/g, '');
    if (!number.startsWith('+')) {
      number = '+' + number;
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(number)) {
      setError(language === 'pt' ? 'Numero invalido (use formato: +5585999999999)' : 'Invalid number (use format: +5585999999999)');
      return;
    }

    await saveSettings(number, notificationsEnabled);
    setWhatsappNumber(number);
  };

  const saveSettings = async (number, enabled) => {
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'settings', auth.currentUser.uid), {
        whatsappNumber: number,
        whatsappNotificationsEnabled: enabled
      }, { merge: true });
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(language === 'pt' ? 'Erro ao salvar' : 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await saveSettings(whatsappNumber, newValue);
  };

  const testNotification = async () => {
    if (!whatsappNumber) {
      setError(language === 'pt' ? 'Configure um numero primeiro' : 'Configure a number first');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError('');

    try {
      const response = await fetch('https://us-central1-controle-financeiro-37e92.cloudfunctions.net/testWhatsApp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: whatsappNumber })
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setError(language === 'pt' ? 'Falha ao enviar mensagem de teste' : 'Failed to send test message');
      }
    } catch (err) {
      console.error('Error testing notification:', err);
      setTestResult('error');
      setError(language === 'pt' ? 'Erro de conexao' : 'Connection error');
    } finally {
      setTesting(false);
    }
  };

  const billsWithReminders = useMemo(() => {
    return bills.filter(bill => bill.status === 'pending' && bill.dueDate);
  }, [bills]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Notificações' : 'Notifications'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* WhatsApp Configuration Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <ChatBubbleBottomCenterTextIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {language === 'pt' ? 'Configurar Numero' : 'Configure Number'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {language === 'pt' ? 'Receba lembretes de contas via WhatsApp' : 'Receive bill reminders via WhatsApp'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Phone Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'pt' ? 'Numero do WhatsApp' : 'WhatsApp Number'}
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  value={whatsappNumber}
                  onChange={(e) => {
                    setWhatsappNumber(e.target.value);
                    setError('');
                    setTestResult(null);
                  }}
                  placeholder="+5585992265544"
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNumber();
                  }}
                />
                <button
                  onClick={saveNumber}
                  disabled={saving}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    language === 'pt' ? 'Salvar' : 'Save'
                  )}
                </button>
              </div>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  {error}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {language === 'pt' ? 'Formato: +55 (DDD) numero' : 'Format: +55 (area code) number'}
              </p>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {notificationsEnabled ? (
                  <BellIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <BellSlashIcon className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {language === 'pt' ? 'Notificacoes ativas' : 'Notifications enabled'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {language === 'pt' ? 'Lembretes diarios as 9h' : 'Daily reminders at 9 AM'}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleNotifications}
                disabled={saving}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  notificationsEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Test Button */}
            {whatsappNumber && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={testNotification}
                  disabled={testing || !notificationsEnabled}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    testResult === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : testResult === 'error'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } disabled:opacity-50`}
                >
                  {testing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      {language === 'pt' ? 'Enviando...' : 'Sending...'}
                    </>
                  ) : testResult === 'success' ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5" />
                      {language === 'pt' ? 'Mensagem enviada!' : 'Message sent!'}
                    </>
                  ) : testResult === 'error' ? (
                    <>
                      <ExclamationTriangleIcon className="w-5 h-5" />
                      {language === 'pt' ? 'Falha no envio' : 'Send failed'}
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-5 h-5" />
                      {language === 'pt' ? 'Enviar mensagem de teste' : 'Send test message'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {language === 'pt' ? 'Como funciona?' : 'How does it work?'}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {language === 'pt'
                  ? 'Todos os dias as 9h da manha (horario de Brasilia), voce recebera um lembrete no WhatsApp sobre as contas que estao proximas do vencimento ou atrasadas.'
                  : 'Every day at 9 AM (Brazil time), you will receive a WhatsApp reminder about bills that are due soon or overdue.'}
              </p>
            </div>
          </div>
        </div>

        {/* Bills with Reminders */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Contas pendentes' : 'Pending bills'}
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({billsWithReminders.length})
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {language === 'pt' ? 'Estas contas serao incluidas nos lembretes' : 'These bills will be included in reminders'}
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {billsWithReminders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-gray-900 dark:text-white">
                  {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {language === 'pt' ? 'Todas as suas contas estao em dia!' : 'All your bills are up to date!'}
                </p>
              </div>
            ) : (
              billsWithReminders.slice(0, 10).map((bill) => {
                const dueDate = new Date(bill.dueDate);
                const today = new Date();
                const isOverdue = dueDate < today;
                const isDueSoon = !isOverdue && (dueDate - today) / (1000 * 60 * 60 * 24) <= 3;

                return (
                  <div key={bill.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {bill.name}
                      </p>
                      <p className={`text-xs ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : isDueSoon
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {isOverdue
                          ? (language === 'pt' ? 'Atrasada - ' : 'Overdue - ')
                          : isDueSoon
                            ? (language === 'pt' ? 'Vence em breve - ' : 'Due soon - ')
                            : ''
                        }
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      isOverdue
                        ? 'bg-red-500'
                        : isDueSoon
                          ? 'bg-amber-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  </div>
                );
              })
            )}
            {billsWithReminders.length > 10 && (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {language === 'pt'
                  ? `+${billsWithReminders.length - 10} outras contas`
                  : `+${billsWithReminders.length - 10} more bills`}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
