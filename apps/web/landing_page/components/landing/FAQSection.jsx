import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'Como funciona o teste grátis?',
    answer: 'Ao criar sua conta você usa o Realwise completo por 3 dias, sem cartão. Lance transações, importe extratos, planeje o mês e veja tudo funcionando antes de decidir.',
  },
  {
    question: 'O que acontece quando o teste termina?',
    answer: 'O acesso ao app é pausado até você assinar. Seus dados continuam guardados e voltam assim que a assinatura é confirmada.',
  },
  {
    question: 'Quais são os planos?',
    answer: 'Há um plano mensal e um plano anual com desconto. O pagamento é feito de forma segura pelo Stripe e você pode usar um código promocional na tela de pagamento.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim. Você gerencia ou cancela a assinatura direto no app, em Configurações. Ao cancelar, o acesso continua até o fim do período já pago.',
  },
  {
    question: 'Funciona no celular?',
    answer: 'Sim. É um PWA — você instala como um app normal no Android ou iPhone direto pelo navegador.',
  },
  {
    question: 'Vocês acessam minha conta bancária?',
    answer: 'Não. Realwise não faz Open Banking nem lê sua conta diretamente. Você importa seus extratos manualmente (CSV ou PDF do seu banco). Simples, seguro e sem nenhuma conexão direta com sua instituição financeira.',
  },
  {
    question: 'Onde meus dados ficam?',
    answer: 'Seus dados ficam protegidos na infraestrutura da Realwise e associados apenas à sua conta. O importante aqui é: não pedimos senha bancária, não conectamos direto ao seu banco e não vendemos seus dados para anúncio.',
  },
  {
    question: 'Preciso conectar meu banco?',
    answer: 'Não precisa. Você baixa o extrato direto no site do seu banco e importa no Realwise em segundos. Sem senhas de banco, sem Open Banking, sem permissões bancárias.',
  },
];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-base pr-8 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
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
    <section id="faq" className="py-24 px-6 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="max-w-3xl mx-auto">
        <div
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">
            Perguntas frequentes.
          </h2>
          <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
            Sem letra miúda: como funciona o teste, os planos e o que acontece depois.
          </p>
        </div>

        <div
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
        </div>
      </div>
    </section>
  );
}
