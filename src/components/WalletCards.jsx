import { useCards, BANK_COLORS } from '../contexts/CardsContext';
import { useSettings } from '../contexts/SettingsContext';

export default function WalletCards({ onManageCards }) {
  const { userBanks, getBankInfo, getBankColor } = useCards();
  const { t, language } = useSettings();

  if (userBanks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Minhas Carteiras' : 'My Wallets'}
          </h3>
        </div>
        <button
          onClick={onManageCards}
          className="w-full py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-2xl">🏦</span>
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Adicionar banco' : 'Add bank'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Minhas Carteiras' : 'My Wallets'}
        </h3>
        <button
          onClick={onManageCards}
          className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline"
        >
          {language === 'pt' ? 'Gerenciar' : 'Manage'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
        {userBanks.map((userBank) => {
          const bankInfo = getBankInfo(userBank.bankId);
          const colors = getBankColor(userBank.bankId);

          return (
            <div
              key={userBank.id}
              className={`h-24 rounded-xl p-4 relative overflow-hidden ${colors.bg} shadow-lg`}
            >
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-2 w-12 h-12 rounded-full border-4 border-white" />
                <div className="absolute bottom-2 left-2 w-8 h-8 rounded-full border-4 border-white" />
              </div>

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bankInfo.icon}</span>
                  <span className="text-white font-semibold text-sm truncate">
                    {bankInfo.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {userBank.hasCredit ? (
                    <span className="text-white/80 text-xs">
                      {language === 'pt' ? 'Crédito' : 'Credit'} • {language === 'pt' ? 'Fecha' : 'Closes'} {userBank.closingDay}
                    </span>
                  ) : (
                    <span className="text-white/80 text-xs">
                      {language === 'pt' ? 'Débito' : 'Debit'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add bank button */}
        <button
          onClick={onManageCards}
          className="h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-all"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs text-gray-400">
            {language === 'pt' ? 'Adicionar' : 'Add'}
          </span>
        </button>
      </div>
    </div>
  );
}
