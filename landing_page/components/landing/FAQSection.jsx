import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'Por que não é uma assinatura?',
    answer: 'Apps de finanças não mudam toda semana — não faz sentido cobrar todo mês. Você compra uma vez, usa para sempre. Sem renovação, sem aumento de preço, sem dependência.',
  },
  {
    question: 'Vou realmente usar? Já abandonei outros apps.',
    answer: 'Setup em 5 minutos. O dashboard mostra valor imediato — você vê seus padrões de gasto desde o primeiro dia. E sem mensalidade, você não tem culpa de "não usar o suficiente".',
  },
  {
    question: 'Como meus dados ficam seguros?',
    answer: 'Seus dados vivem no seu próprio projeto Firebase (infraestrutura do Google). Realwise não tem servidor central com seus dados. Você controla as permissões e pode exportar quando quiser.',
  },
  {
    question: 'Meus dados ficam presos ao Realwise?',
    answer: 'Não. Seus dados vivem no seu próprio Firebase — você é o dono. Pode exportar, migrar ou acessar diretamente quando quiser. Sem dependência.',
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
    question: 'Preciso conectar meu banco?',
    answer: 'Não precisa. Você baixa o extrato direto no site do seu banco (Nubank, Itaú, Bradesco e outros) e importa no Realwise em segundos. Sem senhas de banco, sem Open Banking, sem permissões bancárias.',
  },
  {
    question: 'Diferença para Mobills, YNAB, Organizze?',
    answer: 'Eles são assinatura — você paga enquanto usa. Realwise é compra única — você é dono. Seus dados ficam com você, não com eles. Em 30 anos, você gastaria R$3.600–14.400 com eles e R$479 conosco. Uma vez.',
  },
  {
    question: 'E se eu não gostar?',
    answer: '30 dias de garantia incondicional. Devolvo seu dinheiro, sem perguntar o porquê. O risco é meu, não seu.',
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
