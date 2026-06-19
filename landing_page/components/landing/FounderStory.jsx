import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function FounderStory() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section data-section="founder" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-8"
        >
          <img src="/founder.jpg" alt="Jonatha Lima, founder" className="w-20 h-20 rounded-full object-cover border border-violet-200 dark:border-violet-800" />

          <h2 className="text-2xl sm:text-3xl font-bold text-center leading-snug">
            "Eu construí o Realwise porque eu queria a planilha que se <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">mantivesse sozinha</span>."
          </h2>

          <div className="w-full space-y-4">
            <div className="text-slate-600 dark:text-slate-400 text-left leading-relaxed">
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                Sou Jonatha. Fundador. Cansado de planilhas.
              </p>
              <p className="text-sm">
                Montei uma cheia de fórmulas e larguei — manter viva é exaustivo. Os apps que testei queriam acessar minhas contas, guardar tudo nos servidores deles e ainda cobrar assinatura mensalmente. Não queria isso.
              </p>
            </div>

            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-slate-600 dark:text-slate-400 text-left text-sm space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700"
              >
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Meu compromisso:</span> Você importa. A plataforma organiza. Seus dados ficam no seu Google.
                </p>
                <p>
                  Sou usuário da Realwise também. Melhoro com feedback de quem usa. Como usuário, entendo o que importa e o que não funciona. Isso me motiva a entregar melhor a cada mês.
                </p>
              </motion.div>
            )}

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors pt-2"
            >
              <span>{expanded ? 'Ver menos' : 'Ver mais'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <a href="https://linkedin.com/in/jonathalimax" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            → Jonatha Lima
          </a>
        </motion.div>
      </div>
    </section>
  );
}
