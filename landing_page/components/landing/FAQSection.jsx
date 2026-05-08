import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'O que acontece depois que eu pagar?',
    answer: 'Em até 24h você receberá um e-mail com as instruções de acesso e configuração do seu Realwise. Seu banco de dados Firebase será configurado individualmente — seus dados ficarão no seu próprio projeto Google.',
  },
  {
    question: 'Meus dados ficam seguros?',
    answer: 'Sim. Seus dados ficam armazenados no seu próprio projeto Firebase — vinculado à sua conta Google. Nenhum servidor nosso tem acesso. Você é o único dono dos seus dados.',
  },
  {
    question: 'Funciona no celular?',
    answer: 'Sim. O Realwise é um PWA (Progressive Web App) — você pode instalar no Android ou iOS direto pelo navegador e acessar de qualquer dispositivo.',
  },
  {
    question: 'Posso importar meu extrato bancário?',
    answer: 'Sim. Você importa manualmente o arquivo CSV do seu banco. Nubank, Itaú e Bradesco são suportados com detecção automática de formato. O algoritmo do app categoriza as transações automaticamente.',
  },
  {
    question: 'O que são as novas funcionalidades pagas?',
    answer: 'São features extras opcionais lançadas futuramente — por exemplo, sincronização com a B3, lembretes via WhatsApp, entre outras. Você decide se quer e paga separadamente, sem mudar de plano.',
  },
  {
    question: 'E se eu tiver problemas?',
    answer: 'Suporte vitalício por e-mail está incluído na compra. Correções de bugs e atualizações de segurança são sempre gratuitas.',
  },
];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-base pr-8 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {faq.question}
        </span>
        <ChevronDown className={cn(
          'w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0',
          isOpen && 'rotate-180'
        )} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            Perguntas frequentes
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ficou alguma dúvida?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-8"
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
