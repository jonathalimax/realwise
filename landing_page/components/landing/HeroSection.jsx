import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageToggle';

export default function HeroSection() {
  const { t } = useLanguage();
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20" />
      
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-slate-200/30 dark:bg-slate-500/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {t('hero.badge')}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            {t('hero.headline1')}
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              {t('hero.headline2')}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            {t('hero.subheadline')}
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-full shadow-xl shadow-slate-900/10 dark:shadow-white/10 transition-all duration-300 hover:scale-105"
            >
              {t('hero.cta')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('hero.note')}
            </p>
          </div>

          {/* Device mockup hint */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center gap-6 text-slate-400 dark:text-slate-500"
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              <span className="text-sm">{t('hero.desktop')}</span>
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <span className="text-sm">{t('hero.mobile')}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* App Preview - Using actual screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Desktop mockup */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-black/40 border border-slate-200 dark:border-slate-800 bg-slate-900">
              {/* Browser header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="max-w-md mx-auto h-6 rounded-md bg-slate-700 flex items-center px-3">
                    <span className="text-xs text-slate-400">limas-finance.web.app</span>
                  </div>
                </div>
              </div>
              
              {/* Split screen: Login on right, Info on left */}
              <div className="aspect-[16/9] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
                {/* Left side - Info */}
                <div className="flex-1 p-12 flex flex-col justify-center text-white">
                  <h2 className="text-4xl font-bold mb-4">Assuma o controle das suas finanças</h2>
                  <p className="text-slate-300 mb-8 text-lg leading-relaxed">
                    Acompanhe suas receitas e despesas, visualize seus hábitos de consumo e tome decisões financeiras mais inteligentes.
                  </p>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <div className="text-3xl font-bold mb-1">100%</div>
                      <div className="text-sm text-slate-400">Grátis</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold mb-1">Seguro</div>
                      <div className="text-sm text-slate-400">Armazenamento na nuvem</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold mb-1">Simples</div>
                      <div className="text-sm text-slate-400">Fácil de usar</div>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Login form */}
                <div className="w-[480px] bg-white dark:bg-slate-50 p-10 flex flex-col justify-center">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo de volta</h3>
                    <p className="text-slate-600">Digite suas credenciais para acessar sua conta</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">E-mail</label>
                      <div className="h-11 rounded-lg border-2 border-slate-200 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
                      <div className="h-11 rounded-lg border-2 border-slate-200 bg-white" />
                    </div>
                    <div className="h-11 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-medium">Entrar</span>
                    </div>
                    
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-slate-50 text-slate-500">ou continue com</span>
                      </div>
                    </div>
                    
                    <div className="h-11 rounded-lg border-2 border-slate-200 bg-white flex items-center justify-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-red-500" />
                      <span className="text-slate-700 font-medium text-sm">Google</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-emerald-400/20 rounded-full blur-3xl" />
            <div className="absolute -top-4 -left-4 w-40 h-40 bg-teal-400/20 rounded-full blur-3xl" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}