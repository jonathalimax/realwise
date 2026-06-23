import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { BanksTabContent } from './Cards';
import { useSettings } from '../contexts/SettingsContext';

export default function BanksPage() {
  const navigate = useNavigate();
  const { t } = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={t('banks.title') || 'Banks'} onBack={() => navigate(-1)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        <BanksTabContent />
      </main>
    </div>
  );
}
