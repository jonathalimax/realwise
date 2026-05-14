import React from 'react';
import { Heart } from 'lucide-react';

export default function FooterSection() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-10 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold">Realwise</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 pl-12">
            Seu sistema financeiro. Seus dados. Para sempre.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
          <button onClick={() => scrollTo('funcionalidades')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Funcionalidades
          </button>
          <button onClick={() => scrollTo('preco')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Preço
          </button>
          <button onClick={() => scrollTo('faq')} className="hover:text-slate-900 dark:hover:text-white transition-colors">
            FAQ
          </button>
          <a href="mailto:jonathalimax@gmail.com" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Contato
          </a>
        </nav>

        <div className="flex flex-col items-end gap-1 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>Feito com</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
          </div>
          <span>© 2026 Realwise. Seus dados são 100% seus.</span>
        </div>
      </div>
    </footer>
  );
}
