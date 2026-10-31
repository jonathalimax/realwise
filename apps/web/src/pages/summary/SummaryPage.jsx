import { useEffect, useState } from 'react';
import { ArrowUpTrayIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { summaryResource } from '../../lib/api/resources/summary';
import { shareSummaryCard } from './shareCard';

/**
 * The private "Seu mês em resumo" page, opened from an e-mail link or from Elio. Everything shown comes from the
 * summary payload the API computed; this file only lays it out. Dark and phone-first, one number per row.
 */

const reais = (n) => `R$\u00A0${Math.round(Math.abs(n)).toLocaleString('pt-BR')}`;
const short = (n) => (Math.abs(n) >= 10000 ? `R$\u00A0${(Math.abs(n) / 1000).toFixed(1).replace('.', ',').replace(/,0$/, '')} mil` : reais(n));

const SEGMENT = { slate: '#475569', violet: '#8b5cf6', sky: '#38bdf8', pink: '#f472b6', amber: '#f59e0b', saved: '#10b981', left: '#a7f3d0' };
const CATEGORY_DOTS = ['#475569', '#8b5cf6', '#38bdf8', '#f472b6', '#f59e0b'];

const HERO = {
  proud: { bg: 'linear-gradient(160deg,#0f3d33 0%,#14213d 55%,#2a1b5c 100%)', border: '#1f3b4d', eyebrow: '#6ee7b7', accent: '#6ee7b7', text: '#a7f3d0' },
  steady: { bg: 'linear-gradient(160deg,#10304a 0%,#14213d 60%,#22205c 100%)', border: '#1f3b5d', eyebrow: '#7dd3fc', accent: '#7dd3fc', text: '#bae6fd' },
  improve: { bg: 'linear-gradient(160deg,#4a2a0c 0%,#2b1420 60%,#1d1237 100%)', border: '#5a3a1c', eyebrow: '#fcd34d', accent: '#fcd34d', text: '#fde68a' },
  incomplete: { bg: 'linear-gradient(160deg,#1d1237 0%,#14213d 100%)', border: '#2a2f55', eyebrow: '#c4b5fd', accent: '#c4b5fd', text: '#ddd6fe' },
  trial: { bg: 'linear-gradient(160deg,#1d1237 0%,#14213d 100%)', border: '#2a2f55', eyebrow: '#c4b5fd', accent: '#c4b5fd', text: '#ddd6fe' },
};

function Card({ title, subtitle, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-4 rounded-3xl border border-[#1f2937] bg-[#121826] p-5 ${className}`}>
      {title && (
        <div>
          <h2 className="text-[22px] font-extrabold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-snug text-slate-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function Hero({ s }) {
  const t = HERO[s.tone] ?? HERO.incomplete;
  const pos = s.score === null ? 0 : Math.min(100, Math.max(0, s.score));
  const delta = s.scoreDelta;
  const prev = s.period.prevMonthName;
  return (
    <section className="flex flex-col gap-5 rounded-[28px] border px-5 pb-6 pt-7" style={{ background: t.bg, borderColor: t.border }}>
      <div>
        <p className="text-xs font-extrabold tracking-[0.16em]" style={{ color: t.eyebrow }}>
          {s.tone === 'trial' ? 'SEU TESTE EM RESUMO' : 'SEU MÊS EM RESUMO'}
        </p>
        <h1 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-tight text-white">{s.headline}</h1>
        <p className="mt-3 text-lg leading-snug text-slate-300">{s.subline}</p>
      </div>
      {s.score !== null && (
        <>
          <p className="flex items-baseline gap-2">
            <span className="text-[84px] font-extrabold leading-none tracking-tighter text-white">{s.score}</span>
            <span className="text-[22px] font-bold" style={{ color: t.accent }}>/ 100</span>
          </p>
          <div>
            <div className="relative h-3.5 rounded-full" style={{ background: 'linear-gradient(90deg,#fb7185 0%,#fbbf24 45%,#34d399 75%,#10b981 100%)' }} role="img" aria-label={`Nota ${s.score} de 100`}>
              <div className="absolute -top-[5px] h-6 w-[5px] -translate-x-1/2 rounded bg-white shadow-[0_0_0_4px_rgba(7,11,20,0.55)]" style={{ left: `${pos}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[13px] text-slate-400">
              <span>Atenção</span>
              <span>Equilibrada</span>
              <span>Muito boa</span>
            </div>
          </div>
          <p className="text-base font-bold" style={{ color: t.text }}>
            Saúde financeira: {s.scoreLabel}
            {delta !== null && prev && delta !== 0 ? ` · ${delta > 0 ? `+${delta} pontos` : `${-delta} pontos abaixo de ${prev}`}${delta > 0 ? ` desde ${prev}` : ''}` : ''}
          </p>
        </>
      )}
    </section>
  );
}

function Numbers({ s }) {
  const t = s.totals;
  if (s.tone === 'incomplete' || t.income + t.spent <= 0) return null;
  const rows = [
    ['Entrou', `+${short(t.income)}`, 'text-emerald-400'],
    ['Saiu', short(t.spent), t.left < 0 ? 'text-rose-300' : 'text-white'],
  ];
  if (t.invested > 0) rows.push(['Guardou', short(t.invested), 'text-violet-300']);
  if (t.left >= 0 && (t.invested === 0 || t.left > 0)) rows.push(['Sobrou', short(t.left), 'text-emerald-300']);
  else if (t.left < 0) rows.push(['Faltou', `−${short(t.left)}`, 'text-rose-300']);
  return (
    <Card title={s.tone === 'trial' ? `${(s.period.windowLabel ?? 'seus dias').replace(/^./, (c) => c.toUpperCase())} em números` : 'Seu mês em números'}>
      <div className="flex flex-col gap-3.5">
        {rows.map(([label, value, color]) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-lg text-slate-400">{label}</span>
            <span className={`text-[30px] font-extrabold tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      {t.savingRate !== null && s.tone !== 'trial' && (
        <p className="border-t border-[#1f2937] pt-3.5 text-[15px] leading-relaxed text-slate-400">
          {t.savingRate >= 0 ? (
            <>Você poupou <strong className="text-violet-300">{Math.round(t.savingRate * 100)}% da renda</strong> (o que sobrou mais o que foi investido).</>
          ) : (
            <>Os gastos passaram da renda em <strong className="text-rose-300">{Math.round(-t.savingRate * 100)}%</strong>.</>
          )}
          {t.invested > 0 && ' Investimentos aparecem em “Guardou”, não em “Saiu”.'}
        </p>
      )}
    </Card>
  );
}

function Flow({ s }) {
  const { segments, totalPct, overflow } = s.flow;
  if (s.totals.income <= 0 || segments.length === 0) return null;
  const base = Math.max(100, totalPct);
  return (
    <Card title="Para onde foi a renda" subtitle={overflow ? `De cada R$ 100 que entraram, saíram R$ ${Math.round(totalPct)}. O trecho além da linha branca é o que passou.` : 'Cada R$ 100 que entraram, e para onde foram.'}>
      <div className="relative pt-1.5">
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Divisão da renda">
          {segments.map((g) => <div key={g.key} style={{ width: `${(g.pct / base) * 100}%`, background: SEGMENT[g.tone] }} />)}
        </div>
        {overflow && <div className="absolute top-0 h-7 w-[3px] rounded bg-white" style={{ left: `${(100 / base) * 100}%` }} />}
      </div>
      <div className="flex flex-col gap-3.5">
        {segments.map((g) => (
          <div key={g.key} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SEGMENT[g.tone] }} />
            <span className="flex-1 truncate text-lg text-slate-100">{g.label}</span>
            <span className="text-lg font-extrabold tabular-nums text-white">{reais(g.amount)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Categories({ s }) {
  if (s.categories.length === 0 || s.tone === 'incomplete') return null;
  const prev = s.period.prevMonthName;
  return (
    <Card title="Onde mais gastou" subtitle={prev ? `Em comparação com ${prev}` : undefined}>
      <div className="flex flex-col gap-3.5">
        {s.categories.map((c, i) => (
          <div key={c.name} className="flex items-start gap-3">
            <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORY_DOTS[i % CATEGORY_DOTS.length] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg text-slate-100">{c.name}</p>
              {c.deltaPct !== null && Math.abs(c.deltaPct) >= 10 && (
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${c.deltaPct < 0 ? 'bg-emerald-400 text-emerald-950' : c.deltaPct >= 25 ? 'bg-amber-400 text-amber-950' : 'bg-slate-700 text-slate-200'}`}>
                  {c.deltaPct < 0 ? `${-c.deltaPct}% a menos` : `${c.deltaPct}% a mais`}
                </span>
              )}
            </div>
            <span className="text-lg font-extrabold tabular-nums text-white">{reais(c.amount)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Trend({ s }) {
  const pts = s.trend;
  if (pts.filter((p) => p.income + p.spent > 0).length < 2) return null;
  const scale = Math.max(...pts.map((p) => Math.max(p.income, p.spent)), 1);
  const H = 100;
  const y = (v) => 130 - (v / scale) * H;
  const x = (i) => 12 + i * 58;
  const incomeLine = pts.map((p, i) => (p.income > 0 ? `${x(i) + 18},${y(p.income)}` : null)).filter(Boolean).join(' ');
  const last = pts.length - 1;
  const over = (p) => p.spent + 0 > p.income && p.income > 0;
  return (
    <Card title="Os últimos meses" subtitle="As barras são o que você gastou. A linha roxa é a sua renda.">
      <svg viewBox="0 0 346 164" width="100%" role="img" aria-label="Gastos e renda dos últimos meses">
        <line x1="0" y1="130" x2="346" y2="130" stroke="#1f2937" />
        {pts.map((p, i) => (
          <rect key={p.month} x={x(i)} y={y(p.spent)} width="36" height={Math.max(2, 130 - y(p.spent))} rx="8" fill={i === last ? (over(p) ? '#fb7185' : '#34d399') : over(p) ? '#fbbf24' : '#334155'} />
        ))}
        {incomeLine && <polyline points={incomeLine} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />}
        <g fontSize="13" fill="#94a3b8" textAnchor="middle" fontFamily="inherit">
          {pts.map((p, i) => <text key={p.month} x={x(i) + 18} y="152" fontWeight={i === last ? 800 : 400} fill={i === last ? '#e2e8f0' : '#94a3b8'}>{p.label}</text>)}
        </g>
      </svg>
    </Card>
  );
}

function Budget({ s }) {
  if (!s.budget) return null;
  const dot = { needs: '#60a5fa', wants: '#f472b6', savings: '#5eead4' };
  const phrase = (b) => (b.state === 'left' ? `Sobrou ${reais(b.amount)}` : b.state === 'over' ? `Passou ${reais(b.amount)}` : b.state === 'goal' ? 'Meta batida' : `Faltam ${reais(b.amount)}`);
  const bar = (b) => (b.state === 'over' ? '#fb7185' : b.state === 'goal' ? dot.savings : b.usedPct >= 85 && b.key !== 'savings' ? '#fbbf24' : dot[b.key]);
  return (
    <Card title="Seu orçamento">
      {s.budget.map((b) => (
        <div key={b.key}>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="flex min-w-0 items-center gap-2.5 text-lg"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dot[b.key] }} /><span className="truncate">{b.label}</span></span>
            <span className={`shrink-0 whitespace-nowrap text-lg font-extrabold ${b.state === 'over' ? 'text-rose-400' : b.state === 'goal' ? 'text-teal-300' : 'text-white'}`}>{phrase(b)}</span>
          </div>
          <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-[#1f2937]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(b.usedPct > 0 ? 2 : 0, b.usedPct))}%`, background: bar(b) }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function Streak({ s }) {
  const { monthsInBlue, months } = s.streak;
  if (monthsInBlue < 2) return null;
  return (
    <Card title="Suas conquistas">
      <div className="flex items-center gap-3.5 rounded-2xl bg-[#0f2a22] p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500"><CheckIcon className="h-6 w-6 text-emerald-950" strokeWidth={3} /></span>
        <div>
          <p className="text-lg font-extrabold text-white">{monthsInBlue} meses seguidos no azul</p>
          <p className="text-sm text-slate-400">As receitas ficaram acima das despesas em cada um deles.</p>
        </div>
      </div>
      <div className="flex justify-between gap-2.5" role="img" aria-label={`${monthsInBlue} meses seguidos no azul`}>
        {months.map((m, i) => (
          <div key={m.month} className="flex-1 text-center">
            <div className={`h-3 rounded-full ${m.blue ? 'bg-emerald-400' : 'bg-[#1f2937]'}`} />
            <p className={`mt-1.5 text-xs ${i === months.length - 1 ? 'font-extrabold text-emerald-300' : 'text-slate-500'}`}>{m.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightList({ title, subtitle, items, kind, appHref }) {
  if (items.length === 0) return null;
  return (
    <Card title={title} subtitle={subtitle}>
      {items.map((it, i) => {
        const tone = kind === 'win' ? 'bg-emerald-500 text-emerald-950' : it.urgent ? 'bg-rose-200 text-rose-800' : 'bg-amber-100 text-amber-800';
        return (
          <div key={it.title} className={`flex flex-col gap-2 rounded-2xl p-4 ${it.urgent ? 'border border-[#5b2237] bg-[#2a1420]' : 'bg-[#151b2b]'}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${tone}`}>
                {kind === 'win' ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : it.urgent ? '!' : i + 1}
              </span>
              <span className="text-lg font-extrabold text-white">{it.title}</span>
            </div>
            <p className="text-[15px] leading-snug text-slate-400">{it.detail}</p>
            {it.frees ? <span className="self-start rounded-full bg-emerald-400 px-3 py-1.5 text-sm font-extrabold text-emerald-950">libera {reais(it.frees)} por mês</span> : null}
            {it.href && <a href={appHref(it.href)} className="self-start rounded-full bg-[#1f2937] px-3.5 py-2 text-sm font-extrabold text-violet-200 no-underline">{it.urgent ? 'Ver contas atrasadas' : 'Resolver com o Elio'}</a>}
          </div>
        );
      })}
    </Card>
  );
}

function Missing({ s, appHref }) {
  if (s.missing.length === 0) return null;
  return (
    <Card title="O que falta">
      {s.missing.map((m, i) => (
        <div key={m.key} className="flex items-start gap-3.5 rounded-2xl bg-[#151b2b] p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-violet-500 font-extrabold text-violet-200">{i + 1}</span>
          <div className="flex flex-col gap-1.5">
            <p className="text-[17px] font-bold text-white">{m.title}</p>
            <p className="text-sm leading-snug text-slate-400">{m.detail}</p>
            <a href={appHref(m.ctaPath)} className="mt-1 self-start rounded-full bg-violet-500 px-4 py-2 text-sm font-extrabold text-white no-underline">{m.ctaLabel}</a>
          </div>
        </div>
      ))}
    </Card>
  );
}

function ShareCard({ share }) {
  const [busy, setBusy] = useState(false);
  if (!share) return null;
  return (
    <Card title="Compartilhe sem mostrar valores" subtitle="O cartão usa só porcentagens. Seu saldo nunca aparece.">
      <div className="flex h-[290px] w-[232px] flex-col justify-between self-center rounded-[22px] p-[22px]" style={{ background: 'linear-gradient(160deg,#10b981 0%,#7c3aed 100%)' }}>
        <span className="text-[11px] font-extrabold tracking-[0.18em] text-white/80">REALWISE</span>
        <div>
          <p className="text-[52px] font-extrabold leading-none tracking-tight text-white">{share.value}</p>
          <p className="mt-2 text-lg font-bold leading-tight text-white">{share.caption}</p>
        </div>
        <span className="text-[13px] font-bold text-white/90">{share.footer ?? ' '}</span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => { setBusy(true); shareSummaryCard(share).finally(() => setBusy(false)); }}
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#1f2937] text-base font-extrabold text-slate-100 disabled:opacity-60"
      >
        <ArrowUpTrayIcon className="h-5 w-5" /> Compartilhar cartão
      </button>
    </Card>
  );
}

function NextStep({ s, appHref }) {
  const n = s.nextStep;
  return (
    <section className="flex flex-col gap-3.5 rounded-3xl border border-[#3b2a7a] p-5" style={{ background: 'linear-gradient(160deg,#2a1b5c 0%,#1b1440 100%)' }}>
      <p className="text-xs font-extrabold tracking-[0.16em] text-violet-300">{n.eyebrow}</p>
      <p className="text-[22px] font-extrabold leading-tight text-white">{n.text}</p>
      <a href={appHref(n.ctaPath)} className="flex min-h-[52px] items-center justify-center rounded-2xl bg-violet-500 text-[17px] font-extrabold text-white no-underline">{n.ctaLabel}</a>
    </section>
  );
}

function Shell({ children }) {
  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = '#070b14';
    document.documentElement.classList.add('dark');
    return () => { document.body.style.background = previous; };
  }, []);
  return <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col gap-3.5 bg-[#070b14] px-4 pb-10 pt-4 font-sans text-slate-50">{children}</div>;
}

function Brand({ s }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pb-0.5 pt-1.5">
      <img src="/logo.png" alt="" className="h-8 w-8 rounded-[9px] object-contain" />
      <span className="text-[13px] font-bold text-slate-400">{s ? (s.tone === 'trial' ? 'Seu teste' : s.period.label) : 'Realwise'}</span>
    </div>
  );
}

export default function SummaryPage() {
  const token = window.location.pathname.split('/').filter(Boolean)[1] ?? '';
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    summaryResource
      .byToken(token)
      .then((data) => active && setState({ loading: false, data, error: null }))
      .catch((error) => active && setState({ loading: false, data: null, error }));
    return () => { active = false; };
  }, [token]);

  if (state.loading) {
    return (
      <Shell>
        <Brand />
        {[220, 180, 160].map((h) => <div key={h} className="animate-pulse rounded-3xl bg-[#121826]" style={{ height: h }} />)}
      </Shell>
    );
  }
  if (state.error || !state.data) {
    const gone = state.error?.status === 404;
    return (
      <Shell>
        <Brand />
        <Card>
          <ExclamationTriangleIcon className="h-8 w-8 text-amber-300" />
          <h1 className="text-2xl font-extrabold text-white">{gone ? 'Este resumo não está mais disponível' : 'Não conseguimos abrir o resumo'}</h1>
          <p className="text-base leading-snug text-slate-400">{gone ? 'O link expirou ou não existe. Peça um novo ao Elio: é só dizer “me mostra meu resumo”.' : 'Tente de novo em instantes.'}</p>
          <a href="/login" className="flex min-h-[52px] items-center justify-center rounded-2xl bg-violet-500 text-base font-extrabold text-white no-underline">Abrir o Realwise</a>
        </Card>
      </Shell>
    );
  }

  const { summary: s, clientId } = state.data;
  const appHref = (path) => (path.startsWith('/') && clientId ? `/${clientId}${path}` : '/login');
  return (
    <Shell>
      <Brand s={s} />
      <Hero s={s} />
      <Missing s={s} appHref={appHref} />
      <Numbers s={s} />
      <Flow s={s} />
      <Categories s={s} />
      <Trend s={s} />
      <Budget s={s} />
      <Streak s={s} />
      <InsightList title={s.tone === 'improve' ? 'O que foi bem' : 'O que você fez bem'} items={s.wins.filter((w) => !/seguidos no azul/.test(w.title))} kind="win" appHref={appHref} />
      <InsightList title={s.tone === 'trial' ? 'O que o Elio já encontrou' : s.tone === 'improve' ? 'Por onde começar' : 'Onde dá para ajustar'} subtitle={s.tone === 'improve' ? 'Do que mais rende ao que mais urge.' : undefined} items={s.fixes} kind="fix" appHref={appHref} />
      <NextStep s={s} appHref={appHref} />
      <ShareCard share={s.share} />
      <p className="px-1 pt-2 text-center text-xs leading-relaxed text-slate-500">
        Só você vê esta página. O link expira em 30 dias.
        <br />
        Resumo gerado com os dados que você registrou no Realwise.
      </p>
    </Shell>
  );
}
