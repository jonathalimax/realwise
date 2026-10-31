import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Download, ExternalLink, FileText, Pencil, PlugZap, RefreshCw, Save, Send, Settings2, UserRound } from 'lucide-react';
import { invoicingResource } from '../../lib/api/resources/invoicing';
import { friendlyError } from '../../lib/api/errors';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { brl, date, dateTime, num } from '../../lib/format';
import {
  AsyncView, Badge, Button, Card, ConfirmDialog, EmptyState, Field, InlineMessage, Modal, PageHeader, Pagination, Stat, TableWrap, Toast, Toggle, inputClass, tdClass, thClass,
} from '../../components/ui';

const STATUS = {
  review: { label: 'Aguardando revisão', tone: 'amber' },
  queued: { label: 'Na fila', tone: 'blue' },
  processing: { label: 'Na Prefeitura', tone: 'blue' },
  issued: { label: 'Emitida', tone: 'green' },
  error: { label: 'Com erro', tone: 'red' },
  canceled: { label: 'Cancelada', tone: 'gray' },
  skipped: { label: 'Dispensada', tone: 'gray' },
};
const FILTERS = [['all', 'Todas'], ['review', 'Revisão'], ['queued', 'Na fila'], ['processing', 'Na Prefeitura'], ['issued', 'Emitidas'], ['error', 'Erros'], ['canceled', 'Canceladas'], ['skipped', 'Dispensadas']];
const CAN_ISSUE = ['review', 'queued', 'error', 'skipped'];

const docLabel = (d) => (!d ? 'não informado' : d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'));

function StatusBadge({ row }) {
  const s = STATUS[row.status] ?? { label: row.status, tone: 'gray' };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={s.tone}>{s.label}</Badge>
      {row.status === 'issued' && row.environment === 'homologacao' && <Badge tone="purple">TESTE</Badge>}
      {row.refundedCents > 0 && row.status === 'issued' && <Badge tone="red">Reembolsada</Badge>}
    </span>
  );
}

/* ------------------------------------------------------------------ customer modal */

function CustomerModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const a = row.customerAddress ?? {};
    return { name: row.customerName ?? '', email: row.customerEmail ?? '', doc: row.customerDoc ?? '', cep: a.cep ?? '', street: a.street ?? '', number: a.number ?? '', complement: a.complement ?? '', neighborhood: a.neighborhood ?? '', cityIbge: a.cityIbge ?? '', uf: a.uf ?? '' };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hasAddress = form.street || form.cep;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await invoicingResource.updateCustomer(row.id, {
        name: form.name, email: form.email, doc: form.doc,
        address: hasAddress ? { cep: form.cep, street: form.street, number: form.number, complement: form.complement, neighborhood: form.neighborhood, cityIbge: form.cityIbge, uf: form.uf } : null,
      });
      onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} wide title="Dados do tomador" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <InlineMessage>{error}</InlineMessage>
      <InlineMessage tone="info">Sem CPF/CNPJ válido, a nota sai só com o nome do cliente. O endereço é opcional para pessoa física.</InlineMessage>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nome / razão social"><input className={inputClass} value={form.name} onChange={set('name')} /></Field>
        <Field label="E-mail"><input className={inputClass} value={form.email} onChange={set('email')} /></Field>
        <Field label="CPF ou CNPJ" hint="Só números ou com máscara."><input className={inputClass} value={form.doc} onChange={set('doc')} inputMode="numeric" /></Field>
        <Field label="CEP"><input className={inputClass} value={form.cep} onChange={set('cep')} /></Field>
        <Field label="Logradouro"><input className={inputClass} value={form.street} onChange={set('street')} /></Field>
        <Field label="Número"><input className={inputClass} value={form.number} onChange={set('number')} /></Field>
        <Field label="Complemento"><input className={inputClass} value={form.complement} onChange={set('complement')} /></Field>
        <Field label="Bairro"><input className={inputClass} value={form.neighborhood} onChange={set('neighborhood')} /></Field>
        <Field label="Código IBGE da cidade" hint="São Paulo = 3550308"><input className={inputClass} value={form.cityIbge} onChange={set('cityIbge')} /></Field>
        <Field label="UF"><input className={inputClass} maxLength={2} value={form.uf} onChange={set('uf')} /></Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ notes tab */

function NotesTab({ config, goToSettings }) {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useAsync(() => invoicingResource.list({ status, q: dq, page }), `${status}|${dq}|${page}`);
  const stats = useAsync(() => invoicingResource.stats(), 'inv-stats');
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  const [edit, setEdit] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');
  const [bulk, setBulk] = useState(false);

  const refresh = () => { list.reload(true); stats.reload(true); };
  const say = (message, tone = 'success') => setToast({ message, tone });

  // While the Prefeitura is authorizing, look again every 15 s.
  const hasProcessing = (list.data?.rows ?? []).some((r) => r.status === 'processing' || r.status === 'queued');
  useEffect(() => {
    if (!hasProcessing) return undefined;
    const t = setInterval(() => list.reload(true), 15000);
    return () => clearInterval(t);
  }, [hasProcessing, list]);

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      const res = await fn();
      say(res?.status === 'error' ? `Erro: ${res.errorMessage}` : okMsg, res?.status === 'error' ? 'error' : 'success');
    } catch (e) {
      say(friendlyError(e), 'error');
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const byStatus = stats.data?.byStatus ?? {};
  const count = (k) => byStatus[k]?.count ?? 0;

  const doBackfill = async () => {
    try {
      const r = await invoicingResource.backfill();
      say(`${num(r.created)} pagamentos importados de ${num(r.scanned)} faturas pagas no Stripe.`);
      refresh();
    } catch (e) {
      say(friendlyError(e), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {config && config.missing.length > 0 && (
        <InlineMessage tone="warning">
          Falta configurar: {config.missing.join(', ')}. <button type="button" className="underline" onClick={goToSettings}>Abrir configuração</button>
        </InlineMessage>
      )}
      {config && config.environment === 'homologacao' && (
        <InlineMessage tone="info">Ambiente de <strong>homologação</strong>: as notas emitidas aqui são de teste e não têm validade fiscal. Nada é emitido automaticamente.</InlineMessage>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Emitidas" value={num(count('issued'))} hint={brl(byStatus.issued?.cents ?? 0)} icon={CheckCircle2} tone="text-emerald-400" />
        <Stat label="Aguardando revisão" value={num(count('review'))} icon={FileText} tone={count('review') ? 'text-amber-300' : 'text-white'} />
        <Stat label="Com erro" value={num(count('error'))} icon={AlertTriangle} tone={count('error') ? 'text-red-400' : 'text-white'} />
        <Stat label="Reembolsos a avaliar" value={num(stats.data?.refundedToReview ?? 0)} hint="Nota emitida e pagamento devolvido" icon={Ban} tone={stats.data?.refundedToReview ? 'text-red-400' : 'text-white'} />
      </div>

      <Card padded={false}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 border-b border-gray-800">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setStatus(key); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs border ${status === key ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'text-gray-400 border-gray-800 hover:bg-gray-800'}`}>
                {label}{key !== 'all' && count(key) ? ` · ${count(key)}` : ''}
              </button>
            ))}
          </div>
          <input className={`${inputClass} lg:w-64`} placeholder="Buscar cliente, e-mail, nº da nota…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <div className="flex gap-2">
            <Button size="sm" icon={Download} onClick={doBackfill}>Importar do Stripe</Button>
            {count('review') > 0 && config?.environment === 'producao' && <Button size="sm" variant="primary" icon={Send} onClick={() => setBulk(true)}>Emitir pendentes ({count('review')})</Button>}
          </div>
        </div>

        <AsyncView state={list} isEmpty={(d) => !d.rows.length} empty={<EmptyState icon={FileText} title="Nenhuma nota por aqui" description="Cada pagamento aprovado no Stripe aparece aqui. Use “Importar do Stripe” para trazer pagamentos anteriores (defina a data de início na configuração)." />}>
          {(data) => (
            <>
              <TableWrap>
                <table className="min-w-full">
                  <thead><tr><th className={thClass}>Pago em</th><th className={thClass}>Cliente</th><th className={thClass}>Valor</th><th className={thClass}>Status</th><th className={thClass}>Nota</th><th className={thClass}>Ações</th></tr></thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-900/60">
                        <td className={tdClass}>{date(r.paidAt)}</td>
                        <td className={tdClass}>
                          <div className="font-medium text-gray-200">{r.customerName || '—'}</div>
                          <div className="text-xs text-gray-500">{r.customerEmail || '—'} · CPF/CNPJ: {docLabel(r.customerDoc)}</div>
                          {r.userId && <a className="text-xs text-emerald-400 hover:underline" href={`/admin/users/${r.userId}`}>ver usuário</a>}
                        </td>
                        <td className={tdClass}>{brl(r.amountCents)}{r.planLabel && <div className="text-xs text-gray-500">{r.planLabel}</div>}</td>
                        <td className={tdClass}>
                          <StatusBadge row={r} />
                          {r.errorMessage && <div className="text-xs text-red-400 mt-1 max-w-xs break-words">{r.errorMessage}</div>}
                          {r.skipReason && r.status === 'skipped' && <div className="text-xs text-gray-500 mt-1 max-w-xs">{r.skipReason}</div>}
                          {r.refundedCents > 0 && <div className="text-xs text-red-300 mt-1">Reembolsado {brl(r.refundedCents)}: avalie cancelar a nota.</div>}
                        </td>
                        <td className={tdClass}>
                          {r.nfseNumber ? <div>nº {r.nfseNumber}<div className="text-xs text-gray-500">{dateTime(r.issuedAt)}</div></div> : '—'}
                          <div className="flex gap-2 text-xs mt-0.5">
                            {r.nfseUrl && <a className="text-emerald-400 hover:underline inline-flex items-center gap-0.5" href={r.nfseUrl} target="_blank" rel="noreferrer">Nota <ExternalLink className="w-3 h-3" /></a>}
                            {r.pdfUrl && <a className="text-emerald-400 hover:underline" href={r.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                            {r.xmlPath && <a className="text-emerald-400 hover:underline" href={r.xmlPath} target="_blank" rel="noreferrer">XML</a>}
                            <a className="text-gray-500 hover:underline" href={r.stripeUrl} target="_blank" rel="noreferrer">Stripe</a>
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-1.5">
                            {(CAN_ISSUE.includes(r.status) || (r.status === 'issued' && r.environment === 'homologacao' && config?.environment === 'producao')) && (
                              <Button size="sm" variant="primary" icon={Send} loading={busyId === r.id} disabled={!!config?.missing.length}
                                onClick={() => act(r.id, () => invoicingResource.issue(r.id), 'Nota enviada à Prefeitura.')}>
                                {r.status === 'error' ? 'Tentar de novo' : r.status === 'issued' ? 'Emitir real' : 'Emitir'}
                              </Button>
                            )}
                            {(r.status === 'processing' || r.status === 'queued') && r.attempts > 0 && (
                              <Button size="sm" icon={RefreshCw} loading={busyId === r.id} onClick={() => act(r.id, () => invoicingResource.refresh(r.id), 'Status atualizado.')}>Atualizar</Button>
                            )}
                            {['review', 'queued', 'error', 'skipped'].includes(r.status) && <Button size="sm" icon={UserRound} onClick={() => setEdit(r)}>Tomador</Button>}
                            {['review', 'queued', 'error'].includes(r.status) && (
                              <Button size="sm" variant="ghost" onClick={() => act(r.id, () => invoicingResource.skip(r.id, 'Dispensada pelo admin.'), 'Nota dispensada.')}>Dispensar</Button>
                            )}
                            {r.status === 'issued' && <Button size="sm" variant="danger" icon={Ban} onClick={() => { setReason(''); setCancel(r); }}>Cancelar</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
            </>
          )}
        </AsyncView>
      </Card>

      {edit && <CustomerModal key={edit.id} row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); say('Dados do tomador atualizados.'); refresh(); }} />}

      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} title="Cancelar nota fiscal" confirmLabel="Cancelar nota" confirmDisabled={reason.trim().length < 15}
        description={cancel ? `Nota nº ${cancel.nfseNumber} de ${cancel.customerName || 'cliente'} (${brl(cancel.amountCents)}). O cancelamento é definitivo e segue as regras de prazo da Prefeitura.` : ''}
        onConfirm={async () => { await invoicingResource.cancel(cancel.id, reason.trim()); say('Nota cancelada.'); refresh(); }}>
        <Field label="Justificativa (15 a 255 caracteres)">
          <textarea className={inputClass} rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog open={bulk} onClose={() => setBulk(false)} tone="primary" title="Emitir todas as pendentes" confirmLabel="Colocar na fila"
        description={`${count('review')} notas aguardando revisão vão para a fila e são enviadas à Prefeitura na próxima rodada automática (segunda, quarta e sexta, às 10h). Notas emitidas de verdade só podem ser canceladas dentro do prazo da Prefeitura.`}
        onConfirm={async () => { const r = await invoicingResource.queueAll(); say(`${num(r.queued)} notas na fila.`); refresh(); }} />

      <Toast message={toast.message} tone={toast.tone} onDone={() => setToast({ message: '', tone: 'success' })} />
    </div>
  );
}

/* ------------------------------------------------------------------ settings tab */

function toForm(c) {
  return {
    enabled: c.enabled, autoIssue: c.autoIssue, environment: c.environment, startFrom: c.startFrom ?? '',
    cnpj: c.issuer.cnpj, inscricaoMunicipal: c.issuer.inscricaoMunicipal, municipioIbge: c.issuer.municipioIbge,
    optanteSimplesNacional: c.tax.optanteSimplesNacional, regimeEspecialTributacao: c.tax.regimeEspecialTributacao, naturezaOperacao: c.tax.naturezaOperacao,
    itemListaServico: c.tax.itemListaServico, codigoTributarioMunicipio: c.tax.codigoTributarioMunicipio, codigoCnae: c.tax.codigoCnae,
    aliquota: c.tax.aliquota ?? '', issRetido: c.tax.issRetido, description: c.description, token: '',
  };
}

function SettingsTab({ config, reloadConfig }) {
  const [form, setForm] = useState(() => (config ? toForm(config) : null));
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tog = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const body = {
        enabled: form.enabled, autoIssue: form.autoIssue, environment: form.environment, startFrom: form.startFrom || null,
        issuer: { cnpj: form.cnpj, inscricaoMunicipal: form.inscricaoMunicipal, municipioIbge: form.municipioIbge },
        tax: {
          optanteSimplesNacional: form.optanteSimplesNacional, regimeEspecialTributacao: form.regimeEspecialTributacao, naturezaOperacao: form.naturezaOperacao,
          itemListaServico: form.itemListaServico, codigoTributarioMunicipio: form.codigoTributarioMunicipio, codigoCnae: form.codigoCnae,
          aliquota: form.aliquota === '' ? null : Number(String(form.aliquota).replace(',', '.')), issRetido: form.issRetido,
        },
        description: form.description,
        ...(form.token.trim() ? { token: form.token.trim() } : {}),
        ...extra,
      };
      const next = await invoicingResource.saveSettings(body);
      setForm(toForm(next));
      reloadConfig();
      setToast({ message: 'Configuração salva.', tone: 'success' });
    } catch (e) {
      setToast({ message: friendlyError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    setCheck(null);
    try { setCheck(await invoicingResource.checkConnection()); } catch (e) { setCheck({ ok: false, message: friendlyError(e) }); }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try { setTestResult(await invoicingResource.testEmission()); } catch (e) { setTestResult({ error: friendlyError(e) }); } finally { setTesting(false); }
  };

  const prod = form.environment === 'producao';

  return (
    <div className="space-y-4 max-w-3xl">
      <Card title="Emissor (Focus NFe)" subtitle="Serviço que assina e transmite a nota para a Prefeitura de São Paulo com o seu certificado digital.">
        <div className="space-y-3">
          <InlineMessage tone="info">
            Antes: crie a conta na Focus NFe, cadastre a empresa (CNPJ 49.725.579/0001-49) e envie o certificado digital A1 por lá. O token fica criptografado aqui e nunca volta para a tela.
          </InlineMessage>
          <Field label="Token da API" hint={config.tokenConfigured ? `Token configurado (${config.tokenSource === 'env' ? 'variável de ambiente FOCUSNFE_TOKEN' : 'salvo aqui'}). Preencha só para trocar.` : 'Cole o token do ambiente escolhido abaixo (homologação e produção têm tokens diferentes).'}>
            <input className={inputClass} type="password" autoComplete="off" value={form.token} onChange={set('token')} placeholder={config.tokenConfigured ? '••••••••••••' : 'Token'} />
          </Field>
          <Field label="Ambiente">
            <select className={inputClass} value={form.environment} onChange={set('environment')}>
              <option value="homologacao">Homologação (teste, sem validade fiscal)</option>
              <option value="producao">Produção (notas reais)</option>
            </select>
          </Field>
          {prod && <InlineMessage tone="warning">Em produção cada nota emitida é um documento fiscal real, com ISS devido. Use o mesmo ambiente do token.</InlineMessage>}
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={PlugZap} onClick={async () => { await save(); await runCheck(); }}>Salvar e testar conexão</Button>
            {check && <span className={`text-sm ${check.ok ? 'text-emerald-400' : 'text-red-400'}`}>{check.message}</span>}
          </div>
        </div>
      </Card>

      <Card title="Prestador (a empresa)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="CNPJ"><input className={inputClass} value={form.cnpj} onChange={set('cnpj')} /></Field>
          <Field label="Inscrição municipal (CCM)" hint="Cadastro de contribuinte da Prefeitura de São Paulo."><input className={inputClass} value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} /></Field>
          <Field label="Município (IBGE)" hint="São Paulo = 3550308"><input className={inputClass} value={form.municipioIbge} onChange={set('municipioIbge')} /></Field>
        </div>
      </Card>

      <Card title="Tributação do serviço" subtitle="Peça ao seu contador estes valores. Eles definem como o ISS é calculado; o sistema não os inventa.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Item da lista de serviços (LC 116)" hint="Sugerido: 0103 (processamento, armazenamento ou hospedagem de dados, aplicativos e sistemas de informação). Alternativa: 0105 (licenciamento de programas)."><input className={inputClass} value={form.itemListaServico} onChange={set('itemListaServico')} /></Field>
          <Field label="Código de serviço da Prefeitura" hint="Sugerido: 02684 (item 1.03). Alternativa: 02800 (item 1.05). Precisa estar habilitado no seu CCM e combinar com o CNAE 6311-9/00."><input className={inputClass} value={form.codigoTributarioMunicipio} onChange={set('codigoTributarioMunicipio')} /></Field>
          <Field label="CNAE (opcional)"><input className={inputClass} value={form.codigoCnae} onChange={set('codigoCnae')} /></Field>
          <Field label="Alíquota do ISS (opcional)" hint="Em branco = não enviamos. Se preencher, confirme na homologação se o valor saiu certo (ex.: 2,9 para 2,9%)."><input className={inputClass} value={form.aliquota} onChange={set('aliquota')} inputMode="decimal" /></Field>
          <Field label="Natureza da operação">
            <select className={inputClass} value={form.naturezaOperacao} onChange={set('naturezaOperacao')}>
              <option value="1">1 · Tributação no município</option>
              <option value="2">2 · Tributação fora do município</option>
              <option value="3">3 · Isenção</option>
              <option value="4">4 · Imune</option>
              <option value="5">5 · Exigibilidade suspensa (decisão judicial)</option>
              <option value="6">6 · Exigibilidade suspensa (procedimento administrativo)</option>
            </select>
          </Field>
          <Field label="Regime especial de tributação">
            <select className={inputClass} value={form.regimeEspecialTributacao} onChange={set('regimeEspecialTributacao')}>
              <option value="">Nenhum / não se aplica</option>
              <option value="1">1 · Microempresa municipal</option>
              <option value="2">2 · Estimativa</option>
              <option value="3">3 · Sociedade de profissionais</option>
              <option value="4">4 · Cooperativa</option>
              <option value="5">5 · MEI (Simples Nacional)</option>
              <option value="6">6 · ME/EPP (Simples Nacional)</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3"><Toggle checked={form.optanteSimplesNacional} onChange={tog('optanteSimplesNacional')} label="Optante pelo Simples Nacional" /><span className="text-sm text-gray-300">Empresa optante pelo Simples Nacional</span></div>
          <div className="flex items-center gap-3"><Toggle checked={form.issRetido} onChange={tog('issRetido')} label="ISS retido" /><span className="text-sm text-gray-300">ISS retido pelo tomador (raro para consumidor final)</span></div>
        </div>
      </Card>

      <Card title="Texto da nota" subtitle="Descrição do serviço que aparece na nota. Marcadores: {plano} {competencia} {fatura}">
        <textarea className={inputClass} rows={3} maxLength={500} value={form.description} onChange={set('description')} />
      </Card>

      <Card title="Automação">
        <div className="space-y-3">
          <div className="flex items-center gap-3"><Toggle checked={form.enabled} onChange={tog('enabled')} label="Sistema de notas ligado" /><span className="text-sm text-gray-300">Sistema ligado (acompanha as notas e consulta a Prefeitura)</span></div>
          <div className="flex items-center gap-3"><Toggle checked={form.autoIssue} onChange={tog('autoIssue')} label="Emitir automaticamente" disabled={!prod} /><span className="text-sm text-gray-300">Emitir as notas na rodada automática (segunda, quarta e sexta, 10h) {!prod && <em className="text-gray-500">(só em produção)</em>}</span></div>
          <Field label="Emitir notas a partir de" hint="Pagamentos anteriores a esta data nunca geram nota. Necessária também para “Importar do Stripe”."><input className={`${inputClass} sm:max-w-xs`} type="date" value={form.startFrom} onChange={set('startFrom')} /></Field>
        </div>
      </Card>

      {config.environment === 'homologacao' && (
        <Card title="Testar de ponta a ponta" subtitle="Envia uma nota de R$ 1,00 em homologação para validar token, certificado, CCM e códigos de serviço.">
          <Button icon={FileText} loading={testing} disabled={config.missing.length > 0} onClick={runTest}>Enviar nota de teste</Button>
          {config.missing.length > 0 && <p className="text-xs text-amber-300 mt-2">Falta: {config.missing.join(', ')}.</p>}
          {testResult?.error && <div className="mt-3"><InlineMessage>{testResult.error}</InlineMessage></div>}
          {testResult?.result && (
            <div className="mt-3 text-sm space-y-1">
              <p>Resultado: <Badge tone={testResult.result.state === 'issued' ? 'green' : testResult.result.state === 'error' ? 'red' : 'amber'}>{testResult.result.state === 'issued' ? 'Nota de teste autorizada' : testResult.result.state === 'processing' ? 'Ainda processando (consulte de novo em instantes)' : 'Recusada'}</Badge></p>
              {testResult.result.error && <p className="text-red-400 break-words">{testResult.result.error}</p>}
              {testResult.result.url && <a className="text-emerald-400 hover:underline" href={testResult.result.url} target="_blank" rel="noreferrer">Abrir nota de teste</a>}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end sticky bottom-3"><Button variant="primary" icon={Save} loading={busy} onClick={() => save()}>Salvar configuração</Button></div>
      <Toast message={toast.message} tone={toast.tone} onDone={() => setToast({ message: '', tone: 'success' })} />
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Invoices() {
  const [tab, setTab] = useState('notes');
  const config = useAsync(() => invoicingResource.settings(), 'inv-config');
  return (
    <div className="space-y-4">
      <PageHeader title="Notas fiscais" subtitle="NFS-e da Prefeitura de São Paulo para cada pagamento do Stripe." />
      <div className="flex gap-1.5">
        {[{ key: 'notes', label: 'Notas', icon: FileText }, { key: 'settings', label: 'Configuração', icon: Settings2 }].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${tab === t.key ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'text-gray-400 border-gray-800 hover:bg-gray-800'}`}>
            <t.icon className="w-4 h-4" /> {t.label}{t.key === 'settings' && config.data?.missing?.length ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> : null}
          </button>
        ))}
      </div>
      <AsyncView state={config}>
        {(c) => (<>
          {!c.tokenConfigured && (
            <InlineMessage tone="warning">
              <strong>Integração com a Focus NFe pendente.</strong> Nenhuma nota será emitida até você criar a conta na Focus NFe, enviar o certificado A1 e colar o token na aba Configuração.{' '}
              {tab !== 'settings' && <button type="button" className="underline" onClick={() => setTab('settings')}>Abrir configuração</button>}
            </InlineMessage>
          )}
          {tab === 'notes'
          ? <NotesTab config={c} goToSettings={() => setTab('settings')} />
          : <SettingsTab config={c} reloadConfig={() => config.reload(true)} />}
        </>)}
      </AsyncView>
    </div>
  );
}
