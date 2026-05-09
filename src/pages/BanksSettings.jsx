import { BanksTabContent } from './Cards';
import PageHeader from '../components/PageHeader';
import { useSettings } from '../contexts/SettingsContext';

export default function BanksSettingsPage() {
  const { language } = useSettings();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={language === 'pt' ? 'Bancos' : 'Banks'} showMonth={false} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <BanksTabContent />
      </main>
    </div>
  );
}
