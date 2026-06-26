import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}

interface BillGroups {
  overdue: BillEntry[];
  dueToday: BillEntry[];
  dueSoon: BillEntry[];
}

@Injectable()
export class NotificationsService {
  constructor(private readonly mailer: MailerService) {}

  async sendBillReminderEmail(to: string, groups: BillGroups): Promise<void> {
    const total = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
    if (total === 0) return;

    const formatAmount = (v: string) =>
      `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const formatDate = (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    };

    const section = (title: string, bills: BillEntry[]) => {
      if (!bills.length) return '';
      return `<h3>${title}</h3><ul>${bills
        .map(
          (b) =>
            `<li><strong>${b.name}</strong> — ${formatAmount(b.amount)}, vence ${formatDate(b.dueDate)}${b.daysOverdue ? ` (${b.daysOverdue} dias em atraso)` : ''}</li>`,
        )
        .join('')}</ul>`;
    };

    const html = `
      <p>Olá! Aqui estão suas contas pendentes:</p>
      ${section('⚠️ Em atraso', groups.overdue)}
      ${section('📅 Vence hoje', groups.dueToday)}
      ${section('🔔 Vence em breve (1–3 dias)', groups.dueSoon)}
      <p style="font-size:12px;color:#888">Realwise — gestão financeira pessoal</p>
    `;

    await this.mailer.sendMail({
      to,
      subject: `Realwise — lembrete de conta${total > 1 ? 's' : ''}`,
      html,
    });
  }
}
