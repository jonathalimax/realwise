import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  ArrowLeft, 
  Send,
  ChevronUp,
  Clock,
  CheckCircle,
  Circle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LanguageProvider, useLanguage } from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

const roadmapItems = [
  { id: 1, title: 'Recurring transactions', status: 'in-progress', type: 'feature', votes: 47, description: 'Automatically track monthly subscriptions and bills' },
  { id: 2, title: 'Export to PDF reports', status: 'planned', type: 'feature', votes: 38, description: 'Generate beautiful PDF reports for printing or sharing' },
  { id: 3, title: 'Bank sync integration', status: 'planned', type: 'feature', votes: 35, description: 'Direct connection with major banks for auto-import' },
  { id: 4, title: 'Budget alerts', status: 'in-progress', type: 'feature', votes: 32, description: 'Get notified when approaching budget limits' },
  { id: 5, title: 'Multi-currency conversion', status: 'completed', type: 'feature', votes: 28, description: 'Real-time currency conversion for international users' },
  { id: 6, title: 'Dark mode improvements', status: 'completed', type: 'bug', votes: 24, description: 'Better contrast and consistency in dark mode' },
];



// Moved inside component to access t()

function FeatureRequestsContent() {
  const { t } = useLanguage();
  const [formType, setFormType] = useState('feature');
  const [votes, setVotes] = useState({});

  const statusConfig = {
    'planned': { label: t('feedback.status.planned'), color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
    'in-progress': { label: t('feedback.status.progress'), color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Loader2 },
    'completed': { label: t('feedback.status.completed'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: CheckCircle },
  };

  const handleVote = (id) => {
    setVotes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

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
            <span>{t('nav.back')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className="font-semibold">Limas Finance</span>
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
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('feedback.title')}</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('feedback.subtitle')}
          </p>
        </motion.div>

        <Tabs defaultValue="submit" className="space-y-12">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-12 bg-slate-100 dark:bg-slate-900 rounded-full p-1">
            <TabsTrigger value="submit" className="rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              {t('feedback.submit')}
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              {t('feedback.roadmap')}
            </TabsTrigger>
          </TabsList>

          {/* Submit Tab */}
          <TabsContent value="submit">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <div className="flex gap-4 mb-8">
                  <button
                    onClick={() => setFormType('feature')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      formType === 'feature'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Lightbulb className={`w-6 h-6 mx-auto mb-2 ${formType === 'feature' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${formType === 'feature' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                      {t('feedback.feature')}
                    </span>
                  </button>
                  <button
                    onClick={() => setFormType('bug')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      formType === 'bug'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Bug className={`w-6 h-6 mx-auto mb-2 ${formType === 'bug' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${formType === 'bug' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-400'}`}>
                      {t('feedback.bug')}
                    </span>
                  </button>
                </div>

                <form className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('feedback.title.label')}</label>
                    <Input 
                      placeholder={formType === 'feature' ? t('feedback.title.placeholder.feature') : t('feedback.title.placeholder.bug')}
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('feedback.desc.label')}</label>
                    <Textarea 
                      placeholder={formType === 'feature' ? t('feedback.desc.placeholder.feature') : t('feedback.desc.placeholder.bug')}
                      className="min-h-32 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('feedback.email.label')}</label>
                    <Input 
                      type="email"
                      placeholder={t('donations.email.placeholder')}
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full h-12 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {formType === 'feature' ? t('feedback.submit.feature') : t('feedback.submit.bug')}
                  </Button>
                </form>
              </div>
            </motion.div>
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {roadmapItems.map((item, index) => {
                const StatusIcon = statusConfig[item.status].icon;
                const isVoted = votes[item.id];
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex gap-6 items-start hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {/* Vote button */}
                    <button
                      onClick={() => handleVote(item.id)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                        isVoted 
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <ChevronUp className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.votes + (isVoted ? 1 : 0)}</span>
                    </button>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{item.title}</h3>
                        <Badge variant="secondary" className={item.type === 'feature' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'}>
                          {item.type === 'feature' ? t('feedback.feature') : t('feedback.bug')}
                        </Badge>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{item.description}</p>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 ${item.status === 'in-progress' ? 'animate-spin' : ''} ${
                          item.status === 'completed' ? 'text-emerald-500' : 
                          item.status === 'in-progress' ? 'text-amber-500' : 'text-slate-400'
                        }`} />
                        <span className={`text-sm font-medium ${statusConfig[item.status].color} px-2 py-0.5 rounded-full`}>
                          {statusConfig[item.status].label}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </TabsContent>


        </Tabs>
      </main>
    </div>
  );
}

export default function FeatureRequests() {
  return (
    <LanguageProvider>
      <FeatureRequestsContent />
    </LanguageProvider>
  );
}