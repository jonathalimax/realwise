import React from 'react';
import { Mail, MessageCircle, Instagram } from 'lucide-react';

export default function FooterSection() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-12 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 mb-1">
              <img src="/logo.jpg" alt="Realwise" className="w-9 h-9 rounded-xl object-contain" />
              <span className="font-semibold">Realwise</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
              Seu sistema financeiro. Seus dados. Para sempre.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
              Jonatha Pereira Lima LTDA<br />
              CNPJ 49.725.579/0001-49
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Navegação</span>
            <nav className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400">
              <button onClick={() => scrollTo('funcionalidades')} className="text-left hover:text-slate-900 dark:hover:text-white transition-colors">
                Funcionalidades
              </button>
              <button onClick={() => scrollTo('preco')} className="text-left hover:text-slate-900 dark:hover:text-white transition-colors">
                Preço
              </button>
              <button onClick={() => scrollTo('faq')} className="text-left hover:text-slate-900 dark:hover:text-white transition-colors">
                FAQ
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contato</span>
            <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400">
              <a href="mailto:contato@realwise.com.br" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
                contato@realwise.com.br
              </a>
              <a href="https://wa.me/5541992310339" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4" />
                (41) 99231-0339
              </a>
              <a href="https://instagram.com/realwisebr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Instagram className="w-4 h-4" />
                @realwisebr
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-600">
          <span>© 2026 Realwise. Feito com ❤️ por <a href="https://linkedin.com/in/jonathalimax" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-white transition-colors">Jonatha Lima</a>.</span>
          <div className="flex items-center gap-4">
            <a href="/privacidade" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Política de Privacidade
            </a>
            <a href="/termos" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Termos de Uso
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
