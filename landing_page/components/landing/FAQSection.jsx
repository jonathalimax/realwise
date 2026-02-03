import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/LanguageToggle';

const faqs = [
  {
    question: "Is this a subscription?",
    answer: "No. It's a one-time purchase of $99. You get access to all features available at the time of purchase. Your purchase includes 2 free support changes for bugs or configuration issues. Future updates and customizations require contacting support."
  },
  {
    question: "What support is included?",
    answer: "Your purchase includes 2 free support changes for bugs or wrong configurations only. Custom implementations, new features, or source code access require contacting our support team via the support form."
  },
  {
    question: "Are updates included?",
    answer: "No. Your purchase gives you access to all features available at the time of purchase. Future updates to the system are not automatically included. If you need new features or updates, please contact support via the form."
  },
  {
    question: "Which currencies and languages are supported?",
    answer: "We support BRL (Real), USD (Dollar), EUR (Euro), and GBP (Pound). The app is available in English and Portuguese."
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
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="font-medium text-lg pr-8 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
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
            <p className="pb-6 text-slate-600 dark:text-slate-400 leading-relaxed">
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
      answer: "Não. É uma compra única de R$ 99. Você tem acesso a todos os recursos disponíveis no momento da compra. A compra inclui 2 alterações de suporte gratuitas para bugs ou configurações. Atualizações futuras e personalizações requerem contato com o suporte."
    },
    {
      question: "Qual suporte está incluído?",
      answer: "Sua compra inclui 2 alterações de suporte gratuitas apenas para bugs ou configurações incorretas. Implementações personalizadas, novos recursos ou acesso ao código fonte requerem contato com nossa equipe de suporte através do formulário."
    },
    {
      question: "Atualizações estão inclusas?",
      answer: "Não. Sua compra dá acesso a todos os recursos disponíveis no momento da compra. Atualizações futuras do sistema não estão automaticamente inclusas. Se precisar de novos recursos ou atualizações, entre em contato com o suporte através do formulário."
    },
    {
      question: "Quais moedas e idiomas são suportados?",
      answer: "Suportamos BRL (Real), USD (Dólar), EUR (Euro) e GBP (Libra). O aplicativo está disponível em Inglês e Português."
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
    <section className="py-24 px-6">
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
          className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 px-8"
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