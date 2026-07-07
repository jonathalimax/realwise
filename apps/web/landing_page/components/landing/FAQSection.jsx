import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'O que eu posso usar de graça?',
    answer: 'Você pode começar sem pagar para lançar transações manualmente, importar extratos e entender o que entrou, saiu e em quais categorias seu dinheiro foi parar.',
  },
  {
    question: 'O que entra no Premium?',
    answer: 'Premium é para quem quer ir além do histórico: planejamento, contas, investimentos e a visão de quanto ainda pode gastar com segurança no mês.',
  },
  {
    question: 'O que acontece depois dos 45 dias?',
    answer: 'Depois dos 45 dias, apenas os recursos premium ficam bloqueados. O núcleo gratuito continua funcionando normalmente para entrada manual, importação e leitura do histórico.',
  },
  {
    question: 'Isso quer dizer que o app inteiro vira pago depois?',
    answer: 'Não. A janela de 45 dias vale só para os recursos premium. A proposta é você continuar usando o básico sem fricção e decidir depois se quer subir de nível.',
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
  {
    question: 'Como eu decido se vale pagar pelo Premium?',
    answer: 'Se o básico já resolve seu controle, continue grátis. Se você quer organizar contas, planejar o mês, acompanhar investimentos e enxergar o quanto ainda pode gastar, aí o Premium passa a fazer sentido.',
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
            Sem letra miúda: o que é grátis, o que é premium e quando cada parte faz sentido.
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
