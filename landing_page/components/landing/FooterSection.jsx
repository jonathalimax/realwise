import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FooterSection({ onBuy }) {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="relative overflow-hidden">
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Pronto para assumir o controle
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                das suas finanças?
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto">
              Sem mensalidade. Seus dados só seus. Suporte vitalício incluído.
            </p>
            <Button
              size="lg"
              onClick={onBuy}
              className="h-14 px-10 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              Comprar agora — 12x de R$39,99
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      <div className="border-t border-slate-200 dark:border-slate-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="font-semibold">Moneywise</span>
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

          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Feito com</span>
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>© 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
