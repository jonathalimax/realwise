import React from 'react';
import { motion } from 'framer-motion';

// Drop the real photo at public/founder.jpg and switch the placeholder
// <div> below for an <img src="/founder.jpg" /> once it exists.
export default function FounderStory() {
  return (
    <section data-section="founder" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center gap-6"
        >
          <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-2xl font-bold text-violet-600 dark:text-violet-300">
            JL
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold">
            "Eu construí o Realwise porque eu queria a planilha que se mantivesse sozinha."
          </h2>

          <div className="text-left text-slate-600 dark:text-slate-400 leading-relaxed space-y-4">
            <p>
              Sou Jonatha, desenvolvedor. Como muita gente, eu já montei planilha de gastos cheia de aba e fórmula — e larguei, porque manter aquilo vivo é exaustivo. Experimentei apps, mas todos queriam se conectar às minhas contas e guardar tudo do lado deles. Eu não queria entregar isso.
            </p>
            <p>
              Então fiz o Realwise com uma regra simples: você importa seu extrato, o app organiza, e os dados ficam no seu Google — só seus. Sem conexão com banco, sem servidor meu lendo nada. A leveza de um app, com a privacidade de uma planilha.
            </p>
            <p>
              Não tenho investidor pra agradar nem meta de reter você à força. Tenho o compromisso de te entregar a ferramenta que eu queria ter.
            </p>
          </div>

          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">— Jonatha Lima, fundador</span>
        </motion.div>
      </div>
    </section>
  );
}
