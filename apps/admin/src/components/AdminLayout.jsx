import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen, Bot, Bug, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Mail, Megaphone,
  Menu, ScrollText, Ticket, ShieldCheck, Target, Users, X,
} from 'lucide-react';
import { supportResource } from '../lib/api/resources/support';

const GROUPS = [
  {
    label: 'Resumo',
    items: [{ to: 'overview', label: 'Visão geral', icon: LayoutDashboard }],
  },
  {
    label: 'Clientes',
    items: [
      { to: 'users', label: 'Usuários', icon: Users },
      { to: 'subscriptions', label: 'Assinaturas', icon: CreditCard },
      { to: 'support', label: 'Suporte', icon: LifeBuoy, badge: 'support' },
      { to: 'leads', label: 'Leads e funil', icon: Target },
    ],
  },
  {
    label: 'Inteligência artificial',
    items: [
      { to: 'ai-logs', label: 'Logs de IA', icon: ScrollText },
      { to: 'settings', label: 'IA e Avisos', icon: Bot },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { to: 'emails', label: 'E-mails', icon: Mail },
      { to: 'campaigns', label: 'Campanhas', icon: Megaphone },
      { to: 'coupons', label: 'Códigos promo', icon: Ticket },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: 'errors', label: 'Erros', icon: Bug },
      { to: 'audit', label: 'Auditoria', icon: ShieldCheck },
      { to: 'guia', label: 'Guia', icon: BookOpen },
    ],
  },
];

function useSupportOpenCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const stats = await supportResource.stats();
        const value = typeof stats === 'number' ? stats : (stats?.open ?? stats?.openCount ?? stats?.count ?? 0);
        if (active) setCount(Number(value) || 0);
      } catch {
        if (active) setCount(0);
      }
    }
    load();
    const timer = setInterval(load, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return count;
}

function SidebarContent({ supportCount, onNavigate, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0 border-b border-gray-800">
        <img src="/logo.png" alt="Realwise" className="w-8 h-8 rounded-xl object-contain" />
        <span className="font-bold text-emerald-400 text-base">Realwise Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" aria-label="Navegação principal">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        isActive ? 'bg-emerald-950/60 text-emerald-300 font-medium' : 'text-gray-400 hover:bg-gray-800/70 hover:text-white'
                      }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {badge === 'support' && supportCount > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center">
                        {supportCount > 99 ? '99+' : supportCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-2.5 border-t border-gray-800 flex-shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800/70"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ onLogout }) {
  const [open, setOpen] = useState(false);
  const supportCount = useSupportOpenCount();
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 lg:flex">
      <aside className="hidden lg:block w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 sticky top-0 h-screen">
        <SidebarContent supportCount={supportCount} onLogout={onLogout} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-gray-900 border-r border-gray-800 h-full">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent supportCount={supportCount} onNavigate={() => setOpen(false)} onLogout={onLogout} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-3 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative p-2 rounded-lg text-gray-300 hover:bg-gray-800"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
            {supportCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500" />}
          </button>
          <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg object-contain" />
          <span className="font-bold text-emerald-400">Realwise Admin</span>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
