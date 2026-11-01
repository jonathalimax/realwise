import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { transactionsResource } from '../lib/api/resources/transactions';
import EditSingleTransactionModal from '../components/EditSingleTransactionModal';

export default function TransactionEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useSettings();
  const [transaction, setTransaction] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate(-1);
      return;
    }

    const fetchTransaction = async () => {
      try {
        const row = await transactionsResource.get(id);
        if (!row) {
          navigate(-1);
          return;
        }
        setTransaction(row);
      } catch (error) {
        console.error('Error fetching transaction:', error);
        navigate(-1);
      } finally {
        setPageLoading(false);
      }
    };

    fetchTransaction();
  }, [id, navigate]);

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--rw-bg)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mx-auto" />
          <p className="mt-3 text-sm text-[var(--rw-muted)]">
            {language === 'pt' ? 'Carregando...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <EditSingleTransactionModal
      isOpen={Boolean(transaction)}
      onClose={() => navigate(-1)}
      transaction={transaction}
      onSuccess={() => navigate(-1)}
    />
  );
}
