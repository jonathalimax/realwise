import React from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Cloud, Zap, Download, Lock, ShieldCheck } from 'lucide-react';

const steps = [
  { icon: KeyRound, label: 'Você conecta o Google' },
  { icon: Cloud, label: 'Firebase na sua conta' },
  { icon: Zap, label: 'Realwise lê só quando você usa' },
];

const benefits = [
  { icon: Lock, text: 'No seu Google' },
  { icon: ShieldCheck, text: 'Sem conexão com seu banco' },
  { icon: Download, text: 'Você leva tudo se quiser sair' },
];

export default function DataOwnershipSection() {
  return (
    <section data-section="data-ownership" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Seus dados são seus. Ponto.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A maioria dos apps de finanças precisa se conectar às suas contas e guardar tudo nos servidores deles. O Realwise faz o contrário: seus dados ficam no seu próprio Google, na sua conta. Nenhum servidor nosso tem acesso. Não vendemos dado, não treinamos IA com o seu dinheiro, não temos como ler nada.
          </p>
          <p className="text-base text-slate-500 dark:text-slate-500 max-w-xl mx-auto mt-4">
            É a privacidade que você já tinha na planilha — agora sem o trabalho da planilha.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          {steps.map((step, index) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] leading-tight">
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden sm:block text-slate-300 dark:text-slate-600 text-2xl font-light">
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          {benefits.map((benefit) => (
            <div
              key={benefit.text}
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800"
            >
              <benefit.icon className="w-4 h-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{benefit.text}</span>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
