import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  MessageCircle, 
  Mail,
  Phone,
  Send,
  Clock,
  CheckCircle2,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

function SupportContent() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    description: '',
    urgency: 'normal'
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link 
            to={createPageUrl('Home')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar para Home</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold">Moneywise</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 mb-6">
            <Wrench className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Suporte & Manutenção
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Sua compra inclui 2 alterações de suporte gratuitas para bugs ou configurações incorretas. Para personalizações adicionais, novos recursos ou acesso ao código fonte, entre em contato conosco. Cobramos apenas pelo tempo necessário para resolver sua solicitação.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h2 className="text-2xl font-bold mb-6">Solicitar Manutenção</h2>
              
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome</label>
                  <Input 
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="h-12 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">E-mail</label>
                  <Input 
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="h-12 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Assunto</label>
                  <Input 
                    placeholder="Resumo do problema ou solicitação"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="h-12 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Descrição</label>
                  <Textarea 
                    placeholder="Descreva detalhadamente o que você precisa..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="min-h-32 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Urgência</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['baixa', 'normal', 'alta'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData({...formData, urgency: level})}
                        className={`py-3 rounded-xl font-semibold transition-all ${
                          formData.urgency === level
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <Button 
                  type="submit"
                  className="w-full h-14 text-lg rounded-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Enviar Solicitação
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Info Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* How it works */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h3 className="text-xl font-bold mb-6">Como Funciona</h3>
              <div className="space-y-4">
                {[
                  { icon: MessageCircle, title: 'Envie sua solicitação', desc: 'Descreva o que você precisa através do formulário' },
                  { icon: Clock, title: 'Análise e orçamento', desc: 'Analisamos e retornamos com tempo estimado e custo' },
                  { icon: Wrench, title: 'Manutenção realizada', desc: 'Após aprovação, realizamos o trabalho necessário' },
                  { icon: CheckCircle2, title: 'Entrega e pagamento', desc: 'Você paga apenas pelo tempo utilizado' }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">{step.title}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-8">
              <h3 className="text-xl font-bold mb-4">Modelo de Cobrança</h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Cobramos por hora trabalhada, garantindo que você pague apenas pelo que realmente precisa.
              </p>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">R$ 150</span>
                  <span className="text-slate-500 dark:text-slate-400">/hora</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Cobrança mínima de 30 minutos
                </p>
              </div>
            </div>

            {/* Direct Contact */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
              <h3 className="text-xl font-bold mb-4">Contato Direto</h3>
              <div className="space-y-3">
                <a href="mailto:contato@mymoneywise.web.app" className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <Mail className="w-5 h-5" />
                  <span>contato@mymoneywise.web.app</span>
                </a>
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <Phone className="w-5 h-5" />
                  <span>WhatsApp: +55 (11) 99999-9999</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default function Support() {
  return (
    <LanguageProvider>
      <SupportContent />
    </LanguageProvider>
  );
}