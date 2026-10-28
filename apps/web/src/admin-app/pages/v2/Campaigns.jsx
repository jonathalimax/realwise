import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { campaignsResource } from '../../lib/api/resources/campaigns';
import { toPage } from '../../lib/api/query';
import { useAsync } from '../../lib/useAsync';
import { dateTime, num } from '../../lib/format';
import { AsyncView, Badge, Card, EmptyState, PageHeader, TableWrap, tdClass, thClass } from '../../components/ui';

export const CAMPAIGN_STATUS = {
  draft: { label: 'Rascunho', tone: 'gray' },
  scheduled: { label: 'Agendada', tone: 'blue' },
  sending: { label: 'Enviando', tone: 'amber' },
  sent: { label: 'Enviada', tone: 'green' },
};

export function CampaignStatus({ status }) {
  const meta = CAMPAIGN_STATUS[status] ?? { label: status ?? '—', tone: 'gray' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export default function Campaigns() {
  const state = useAsync(() => campaignsResource.list({ page: 1, pageSize: 50 }), 'list');

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Campanhas"
        subtitle="E-mails de marketing para segmentos de usuários. Quem optou por não receber é sempre excluído."
        actions={(
          <Link to="/campaigns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white">
            <Plus className="w-4 h-4" /> Nova campanha
          </Link>
        )}
      />
      <Card padded={false}>
        <div className="px-3 sm:px-4 py-3">
          <AsyncView
            state={state}
            isEmpty={(d) => toPage(d).items.length === 0}
            empty={(
              <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" description="Crie a primeira campanha para falar com um segmento de usuários.">
                <Link to="/campaigns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white">
                  <Plus className="w-4 h-4" /> Nova campanha
                </Link>
              </EmptyState>
            )}
          >
            {(data) => (
              <TableWrap>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className={thClass}>Campanha</th>
                      <th className={thClass}>Status</th>
                      <th className={`${thClass} text-right`}>Destinatários</th>
                      <th className={`${thClass} text-right hidden sm:table-cell`}>Enviados</th>
                      <th className={`${thClass} text-right hidden sm:table-cell`}>Falhas</th>
                      <th className={`${thClass} hidden md:table-cell`}>Quando</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {toPage(data).items.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-800/40">
                        <td className={tdClass}>
                          <Link to={`/campaigns/${c.id}`} className="block">
                            <span className="block text-white font-medium truncate max-w-[220px] sm:max-w-sm">{c.name}</span>
                            <span className="block text-xs text-gray-500 truncate max-w-[220px] sm:max-w-sm">{c.subject}</span>
                          </Link>
                        </td>
                        <td className={tdClass}><CampaignStatus status={c.status} /></td>
                        <td className={`${tdClass} text-right`}>{num(c.recipientCount)}</td>
                        <td className={`${tdClass} text-right hidden sm:table-cell`}>{num(c.sentCount)}</td>
                        <td className={`${tdClass} text-right hidden sm:table-cell ${c.failedCount ? 'text-red-400' : ''}`}>{num(c.failedCount)}</td>
                        <td className={`${tdClass} whitespace-nowrap hidden md:table-cell`}>
                          {c.status === 'scheduled' ? `Agendada: ${dateTime(c.scheduledAt)}` : dateTime(c.sentAt ?? c.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </AsyncView>
        </div>
      </Card>
    </div>
  );
}
