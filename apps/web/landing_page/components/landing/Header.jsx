import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
export default function Header() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Realwise" className="w-10 h-10 rounded-xl object-contain" />
          <span className="font-bold text-xl tracking-tight">Realwise</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollTo('preco')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Preço
          </button>
          <button
            onClick={() => scrollTo('faq')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            FAQ
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => { sessionStorage.setItem('__rw_show_login', '1'); window.location.href = '/login'; }}
            className="h-9 px-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </header>
  );
}
