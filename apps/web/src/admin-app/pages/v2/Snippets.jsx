import { useState } from 'react';
import { Save } from 'lucide-react';
import { chatSnippetsResource } from '../../lib/api/resources/chatSnippets';
import { friendlyError } from '../../lib/api/errors';
import { useAsync } from '../../lib/useAsync';
import { AsyncView, Button, Card, Field, InlineMessage, PageHeader, Toast, inputClass } from '../../components/ui';

const toForm = (s) => ({
  title: s.title ?? '',
  body: s.body ?? '',
  chips: (s.quickReplies ?? []).join('\n'),
  triggerLabel: s.triggerLabel ?? '',
});

function SnippetCard({ snippet, onSaved }) {
  const [form, setForm] = useState(() => toForm(snippet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const chips = form.chips.split('\n').map((c) => c.trim()).filter(Boolean);
  const tooMany = chips.length > 6;
  const tooLong = chips.some((c) => c.length > 40);
  const dirty = JSON.stringify(toForm(snippet)) !== JSON.stringify(form);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const saved = await chatSnippetsResource.save(snippet.key, {
        title: form.title.trim(),
        body: form.body.trim(),
        quickReplies: chips,
        triggerLabel: form.triggerLabel.trim() || null,
      });
      onSaved(saved);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={snippet.title} subtitle={`Chave: ${snippet.key}`}>
      <div className="space-y-3">
        <Field label="Título (só aparece aqui no admin)">
          <input className={inputClass} value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Texto mostrado pelo Elio" hint="Aceita **negrito** e listas com “- ”. É exibido exatamente como está, sem custo de IA.">
          <textarea className={`${inputClass} min-h-40 font-mono text-[13px]`} maxLength={4000} value={form.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Respostas rápidas (uma por linha)" hint='Até 6, 40 caracteres cada. O "Pular" é adicionado sozinho.'>
            <textarea className={`${inputClass} min-h-24`} value={form.chips} onChange={(e) => set({ chips: e.target.value })} />
          </Field>
          <Field label="Gatilho (opcional)" hint="Quando a pessoa tocar numa resposta com exatamente este texto, este conteúdo aparece direto, sem chamar a IA.">
            <input className={inputClass} maxLength={80} value={form.triggerLabel} onChange={(e) => set({ triggerLabel: e.target.value })} />
          </Field>
        </div>
        {tooMany && <InlineMessage tone="warning">Use no máximo 6 respostas rápidas.</InlineMessage>}
        {tooLong && <InlineMessage tone="warning">Cada resposta rápida tem no máximo 40 caracteres.</InlineMessage>}
        {error && <InlineMessage>{error}</InlineMessage>}
        <div className="flex justify-end">
          <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty || tooMany || tooLong || !form.title.trim() || !form.body.trim()}>
            Salvar texto
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Snippets() {
  const state = useAsync(() => chatSnippetsResource.list(), 'chat-snippets');
  const [saved, setSaved] = useState({}); // key -> the row as last saved here, over what the list returned
  const [toast, setToast] = useState('');

  return (
    <div className="space-y-4">
      <PageHeader title="Textos do Elio" subtitle="Boas-vindas e explicações prontas. Ficam no banco, aparecem sem custo de IA e valem na hora em que você salva." />
      <AsyncView state={state} isEmpty={(d) => !d?.length}>
        {(rows) => rows.map((row) => {
          const s = saved[row.key] ?? row;
          // Keyed by the save time so the form restarts from the saved text.
          return (
            <SnippetCard
              key={`${s.key}-${s.updatedAt}`}
              snippet={s}
              onSaved={(next) => { setSaved((prev) => ({ ...prev, [next.key]: next })); setToast('Texto salvo.'); }}
            />
          );
        })}
      </AsyncView>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  );
}
