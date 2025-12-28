import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/LanguageToggle';

const faqs = [
  {
    question: "Is this a subscription?",
    answer: "No. It's a one-time purchase with lifetime access. You pay once and get access to the app forever, including all future updates."
  },
  {
    question: "Which currencies and languages are supported?",
    answer: "We support BRL (Real), USD (Dollar), EUR (Euro), and GBP (Pound). The app is available in English and Portuguese."
  },
  {
    question: "How do you auto-categorize without AI?",
    answer: "We use rule-based matching and your custom preferences—simple, predictable, and private. You set the rules, and the app follows them consistently without any AI processing your data."
  },
  {
    question: "Will you show where donations go?",
    answer: "Yes. We publish regular donation reports detailing amounts and recipients. Transparency is one of our core values, and we want you to see exactly how your purchase makes a difference."
  },
  {
    question: "Can I import my bank statements?",
    answer: "Yes! You can import statements from most major banks and credit cards. We support common formats like CSV, OFX, and QIF. Manual entry is also available for full control."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. Your data is encrypted and stored securely. We don't use AI to process your information, we don't sell your data, and we never will. Your privacy is paramount."
  }
];

function FAQItem({ faq, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-4 sm:py-6 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-sm sm:text-lg pr-4 sm:pr-8 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {faq.question}
        </span>
        <ChevronDown className={cn(
          "w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 sm:pb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const { t, language } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);
  
  const faqsData = language === 'pt' ? [
    {
      question: "É uma assinatura?",
      answer: "Não. É uma compra única com acesso vitalício. Você paga uma vez e tem acesso ao aplicativo para sempre, incluindo todas as atualizações futuras."
    },
    {
      question: "Quais moedas e idiomas são suportados?",
      answer: "Suportamos BRL (Real), USD (Dólar), EUR (Euro) e GBP (Libra). O aplicativo está disponível em Inglês e Português."
    },
    {
      question: "Como você categoriza automaticamente sem IA?",
      answer: "Usamos correspondência baseada em regras e suas preferências personalizadas—simples, previsível e privado. Você define as regras e o aplicativo as segue de forma consistente sem qualquer processamento de IA dos seus dados."
    },
    {
      question: "Vocês mostram para onde vão as doações?",
      answer: "Sim. Publicamos relatórios regulares de doações detalhando valores e destinatários. Transparência é um dos nossos valores fundamentais, e queremos que você veja exatamente como sua compra faz a diferença."
    },
    {
      question: "Posso importar meus extratos bancários?",
      answer: "Sim! Você pode importar extratos da maioria dos principais bancos e cartões de crédito. Suportamos formatos comuns como CSV, OFX e QIF. Entrada manual também está disponível para controle total."
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Absolutamente. Seus dados são criptografados e armazenados com segurança. Não usamos IA para processar suas informações, não vendemos seus dados e nunca venderemos. Sua privacidade é fundamental."
    }
  ] : faqs;

  return (
    <section className="py-32 px-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3 tracking-wide uppercase">
            {t('faq.label')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t('faq.title')}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 sm:px-8"
        >
          {faqsData.map((faq, index) => (
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