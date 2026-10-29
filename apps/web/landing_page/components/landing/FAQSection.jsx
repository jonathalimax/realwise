import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Preciso de cartão ou pagar algo para testar?',
    a: 'Não. Você usa tudo por 3 dias sem cadastrar cartão e sem pagar nada. Só depois do teste, se quiser continuar, escolhe um plano e paga. Se não assinar, o acesso fica pausado e seus dados continuam guardados.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Seus dados são só seus e ficam protegidos conforme a LGPD. Para ler os extratos usamos IA com provedores configurados para não reter nem treinar com as suas informações.',
  },
  {
    q: 'O que o Elio faz por mim?',
    a: 'Ele conversa com você no primeiro acesso para conhecer suas contas, sua renda e seus objetivos, monta o seu plano, lê seus extratos e faturas, lembra de contas a pagar e responde dúvidas com os seus números. Tudo por chat, digitando ou falando.',
  },
  {
    q: 'Posso falar em vez de digitar?',
    a: 'Pode. Toque no microfone e dite, por exemplo, “gastei 45 no mercado”. O Elio também pode ler as respostas em voz alta.',
  },
  {
    q: 'Quais bancos funcionam?',
    a: 'Qualquer um. O Elio lê PDF, foto, planilha (CSV/XLSX) e OFX de qualquer banco ou cartão, sem precisar conectar sua conta.',
  },
  {
    q: 'Como cancelo?',
    a: 'Quando quiser, em Configurações → Assinatura, sem multa e sem burocracia.',
  },
];

function Item({ item, open, onToggle, id }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <h3>
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold"
        >
          {item.q}
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-button`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section id="faq" data-section="faq" className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Perguntas rápidas</h2>
        <div className="mt-10 border-t border-slate-200 dark:border-slate-800">
          {FAQS.map((item, i) => (
            <Item key={item.q} id={`faq-${i}`} item={item} open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
