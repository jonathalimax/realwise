import React from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Cloud, Zap, Download, Lock, ShieldCheck } from 'lucide-react';

const steps = [
  { icon: KeyRound, label: 'Você conecta o Google' },
  { icon: Cloud, label: 'Firebase na sua conta' },
  { icon: Zap, label: 'Realwise lê só quando você usa' },
];

const benefits = [
  { icon: Lock, text: 'Você controla o acesso' },
  { icon: Download, text: 'Pode exportar a qualquer momento' },
  { icon: ShieldCheck, text: 'Seus dados são independentes — sempre' },
];

export default function DataOwnershipSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Seus dados não passam por nós.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            A maioria dos apps guarda seus dados nos servidores deles. Realwise não.
            Seus dados vivem na sua própria conta Google Firebase — você é o dono,
            nós somos só a ferramenta.
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
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
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

      </div>
    </section>
  );
}
