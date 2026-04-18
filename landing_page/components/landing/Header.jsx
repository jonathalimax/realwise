import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Header({ onBuy }) {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="font-semibold text-lg">Moneywise</span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollTo('funcionalidades')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Funcionalidades
          </button>
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
            onClick={() => window.location.href = '/login'}
            className="h-9 px-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Entrar
          </button>
          <Button
            size="sm"
            onClick={onBuy}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
          >
            Comprar agora
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
