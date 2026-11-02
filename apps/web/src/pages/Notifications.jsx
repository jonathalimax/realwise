import PageHeader from '../components/PageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellIcon,
  BellSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '../contexts/SettingsContext';
import { useBills } from '../contexts/BillsContext';
import { disablePush, enablePush, getPushState, isIOS } from '../lib/push';
import { pushResource } from '../lib/api/resources/push';

const SENDS = [
  ['Contas', 'Todo dia às 9h, se houver conta atrasada ou vencendo nos próximos 3 dias.'],
  ['Extrato pronto', 'Quando o Elio termina de ler um extrato que você enviou.'],
  ['Falta categorizar', 'Um lembrete quando há movimentos sem categoria.'],
  ['Conta que se repete', 'Quando o Elio percebe uma conta mensal e sugere salvá-la.'],
  ['Resumo do mês', 'No começo do mês, quando o resumo do mês anterior fica pronto.'],
  ['Sua semana', 'Domingo às 18h, com quanto você gastou e como foi comparado à semana anterior.'],
];

function Steps({ items }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((text, i) => (
        <li key={text} className="flex gap-3 text-[15px] text-[var(--rw-muted)]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rw-brand-soft)] text-xs font-bold text-[var(--rw-brand-ink)]">{i + 1}</span>
          <span className="pt-px">{text}</span>
        </li>
      ))}
    </ol>
  );
}

function PushCard({ pt }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const refresh = useCallback(() => getPushState().then(setState), []);
  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn) => {
    setBusy(true);
    setNote('');
    try {
      setState(await fn());
    } catch {
      setNote(pt ? 'Não consegui ativar agora. Tente de novo em instantes.' : 'Could not turn it on. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setNote('');
    try {
      const { sent } = await pushResource.test();
      setNote(sent > 0 ? (pt ? 'Enviamos! Deve chegar em alguns segundos.' : 'Sent! It should arrive in a few seconds.') : (pt ? 'Nenhum aparelho recebeu. Desative e ative de novo.' : 'No device received it. Turn it off and on again.'));
    } catch {
      setNote(pt ? 'Não consegui enviar o teste.' : 'Could not send the test.');
    } finally {
      setBusy(false);
    }
  };

  const ios = isIOS();
  const title = pt ? 'Notificações no celular' : 'Phone notifications';
  const subtitle = {
    on: pt ? 'Ativas neste aparelho' : 'On for this device',
    off: pt ? 'Desligadas neste aparelho' : 'Off for this device',
    denied: pt ? 'Bloqueadas no navegador' : 'Blocked in the browser',
    install: pt ? 'Falta instalar o app' : 'Install the app first',
    unsupported: pt ? 'Este navegador não suporta' : 'This browser does not support it',
  }[state] ?? (pt ? 'Verificando…' : 'Checking…');

  return (
    <section className="rw-card flex flex-col gap-4" aria-label={title}>
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${state === 'on' ? 'bg-[var(--rw-brand-soft)]' : 'bg-[var(--rw-raised)]'}`}>
          {state === 'on' ? <BellIcon className="h-6 w-6 text-[var(--rw-brand-ink)]" /> : <BellSlashIcon className="h-6 w-6 text-[var(--rw-muted)]" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <p className="text-[13px] text-[var(--rw-subtle)]">{subtitle}</p>
        </div>
      </div>

      {state === 'off' && (
        <>
          <p className="text-[15px] text-[var(--rw-muted)]">{pt ? 'Um toque e o Elio avisa quando uma conta vence ou quando o seu extrato fica pronto. Sem spam: são poucos avisos por semana.' : 'One tap and Elio tells you when a bill is due or your statement is ready.'}</p>
          <button type="button" disabled={busy} onClick={() => run(enablePush)} className="h-[52px] rounded-[14px] bg-[var(--rw-brand)] text-[15px] font-bold text-white disabled:opacity-60">
            {busy ? (pt ? 'Ativando…' : 'Turning on…') : (pt ? 'Ativar notificações' : 'Turn on notifications')}
          </button>
        </>
      )}

      {state === 'on' && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={sendTest} className="h-12 flex-1 rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold disabled:opacity-60">{pt ? 'Enviar um teste' : 'Send a test'}</button>
          <button type="button" disabled={busy} onClick={() => run(disablePush)} className="h-12 flex-1 rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold text-[var(--rw-neg)] disabled:opacity-60">{pt ? 'Desativar' : 'Turn off'}</button>
        </div>
      )}

      {state === 'install' && (
        <>
          <p className="text-[15px] text-[var(--rw-muted)]">{pt ? 'No iPhone, as notificações só funcionam com o Realwise instalado na Tela de Início. Leva 20 segundos:' : 'On iPhone, notifications only work once Realwise is on your Home Screen:'}</p>
          <Steps items={pt
            ? ['Abra realwise.com.br no Safari.', 'Toque em Compartilhar (o quadrado com a seta para cima).', 'Escolha “Adicionar à Tela de Início” e toque em Adicionar.', 'Abra o Realwise pelo novo ícone e volte a esta tela para ativar.']
            : ['Open realwise.com.br in Safari.', 'Tap Share (the square with an arrow).', 'Choose “Add to Home Screen”, then Add.', 'Open Realwise from the new icon and come back here to turn it on.']} />
          <p className="text-[13px] text-[var(--rw-subtle)]">{pt ? 'Precisa do iOS 16.4 ou mais novo.' : 'Requires iOS 16.4 or newer.'}</p>
        </>
      )}

      {state === 'denied' && (
        <>
          <p className="text-[15px] text-[var(--rw-muted)]">{pt ? 'O navegador está bloqueando os avisos do Realwise. Para liberar:' : 'The browser is blocking Realwise notifications. To allow them:'}</p>
          <Steps items={ios
            ? (pt ? ['Abra os Ajustes do iPhone.', 'Role até Realwise (ou Notificações → Realwise).', 'Ative “Permitir Notificações”.', 'Volte aqui e toque em Ativar.'] : ['Open iPhone Settings.', 'Find Realwise (or Notifications → Realwise).', 'Turn on “Allow Notifications”.', 'Come back and tap Turn on.'])
            : (pt ? ['Toque no cadeado ao lado do endereço do site.', 'Abra “Configurações do site” ou “Permissões”.', 'Em Notificações, escolha “Permitir”.', 'Recarregue a página e toque em Ativar.'] : ['Tap the padlock next to the site address.', 'Open Site settings or Permissions.', 'Set Notifications to Allow.', 'Reload the page and tap Turn on.'])} />
          <button type="button" onClick={refresh} className="h-12 rounded-[14px] bg-[var(--rw-raised)] text-sm font-bold">{pt ? 'Já liberei, verificar de novo' : 'I allowed it, check again'}</button>
        </>
      )}

      {state === 'unsupported' && (
        <p className="text-[15px] text-[var(--rw-muted)]">{pt ? 'Tente abrir o Realwise no Chrome, no Safari (iPhone com iOS 16.4+) ou no Edge. Enquanto isso, você continua recebendo os lembretes por e-mail.' : 'Try Chrome, Safari (iOS 16.4+) or Edge. Meanwhile you still get reminders by e-mail.'}</p>
      )}

      {note && <p className="text-[13px] text-[var(--rw-muted)]" role="status">{note}</p>}
    </section>
  );
}

export default function NotificationsPage() {
  const { language } = useSettings();
  const { bills } = useBills();
  const pt = language === 'pt';

  const billsWithReminders = useMemo(
    () => bills.filter((bill) => bill.status === 'pending' && bill.dueDate),
    [bills]
  );

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={language === 'pt' ? 'Notificações' : 'Notifications'} showMonth={false} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        <div className="mb-4"><PushCard pt={pt} /></div>

        <section className="rw-card mb-6 flex flex-col gap-3" aria-label={pt ? 'O que você recebe' : 'What you get'}>
          <h3 className="text-[17px] font-bold">{pt ? 'O que você vai receber' : 'What you will get'}</h3>
          <div className="divide-y divide-[var(--rw-border)]">
            {SENDS.map(([name, when]) => (
              <div key={name} className="py-2.5">
                <div className="text-[15px] font-semibold">{name}</div>
                <div className="text-[13px] text-[var(--rw-subtle)]">{when}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pending bills list */}
        <div className="bg-[var(--rw-surface)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--rw-border)]">
            <h3 className="font-bold text-[var(--rw-ink)]">
              {language === 'pt' ? 'Contas pendentes' : 'Pending bills'}
              <span className="ml-2 text-sm font-normal text-[var(--rw-muted)]">
                ({billsWithReminders.length})
              </span>
            </h3>
            <p className="text-xs text-[var(--rw-muted)] mt-1">
              {language === 'pt' ? 'Estas contas serão incluídas nos lembretes' : 'These bills will be included in reminders'}
            </p>
          </div>

          <div className="divide-y divide-[var(--rw-border)]">
            {billsWithReminders.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium text-[var(--rw-ink)]">
                  {language === 'pt' ? 'Nenhuma conta pendente' : 'No pending bills'}
                </p>
                <p className="text-sm text-[var(--rw-muted)] mt-1">
                  {language === 'pt' ? 'Todas as suas contas estão em dia!' : 'All your bills are up to date!'}
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
                      <p className="font-medium text-[var(--rw-ink)] text-sm">{bill.name}</p>
                      <p className={`text-xs ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : isDueSoon
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--rw-muted)]'
                      }`}>
                        {isOverdue
                          ? (language === 'pt' ? 'Atrasada - ' : 'Overdue - ')
                          : isDueSoon
                            ? (language === 'pt' ? 'Vence em breve - ' : 'Due soon - ')
                            : ''}
                        {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      isOverdue ? 'bg-red-500' : isDueSoon ? 'bg-amber-500' : 'bg-[var(--rw-track)]'
                    }`} />
                  </div>
                );
              })
            )}
            {billsWithReminders.length > 10 && (
              <div className="p-4 text-center text-sm text-[var(--rw-muted)]">
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
