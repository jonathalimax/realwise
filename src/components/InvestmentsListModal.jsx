import { useState } from 'react';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useSettings } from '../contexts/SettingsContext';
import { XMarkIcon, FunnelIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

export default function InvestmentsListModal({ isOpen, onClose }) {
  const {
    investments,
    loading,
    getCurrentValue,
    getGrowthPercentage,
    getTotalInvested,
    getTotalCurrentValue,
    getTotalGrowth,
    getInvestmentType,
    getDaysHeld
  } = useInvestments();
  const { formatCurrency, t, language } = useSettings();

  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('value'); // value, growth, date, name
  const [sortOrder, setSortOrder] = useState('desc');

  if (!isOpen) return null;

  // Filter investments
  const filteredInvestments = investments.filter(inv => {
    if (filterType === 'all') return true;
    return inv.type === filterType;
  });

  // Sort investments
  const sortedInvestments = [...filteredInvestments].sort((a, b) => {
    let compare = 0;
    switch (sortBy) {
      case 'value':
        compare = getCurrentValue(a) - getCurrentValue(b);
        break;
      case 'growth':
        compare = getGrowthPercentage(a) - getGrowthPercentage(b);
        break;
      case 'date':
        const dateA = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt?.toDate?.() || new Date(0));
        const dateB = b.purchaseDate ? new Date(b.purchaseDate) : (b.createdAt?.toDate?.() || new Date(0));
        compare = dateA - dateB;
        break;
      case 'name':
        compare = (a.name || '').localeCompare(b.name || '');
        break;
      default:
        compare = 0;
    }
    return sortOrder === 'desc' ? -compare : compare;
  });

  // Calculate totals
  const totalInvested = getTotalInvested();
  const totalValue = getTotalCurrentValue();
  const totalGrowth = getTotalGrowth();
  const totalGrowthPercent = totalInvested > 0 ? (totalGrowth / totalInvested) * 100 : 0;

  // Calculate totals by type
  const totalsByType = Object.keys(INVESTMENT_TYPES).reduce((acc, type) => {
    const typeInvestments = investments.filter(inv => inv.type === type);
    acc[type] = {
      count: typeInvestments.length,
      value: typeInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0)
    };
    return acc;
  }, {});

  const InvestmentItem = ({ investment }) => {
    const typeInfo = getInvestmentType(investment.type);
    const currentValue = getCurrentValue(investment);
    const growthPercent = getGrowthPercentage(investment);
    const growth = currentValue - (investment.initialAmount || 0);
    const daysHeld = getDaysHeld(investment);

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      return date.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
            ${investment.type === 'fixed_income' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}
            ${investment.type === 'stocks' ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}
            ${investment.type === 'crypto' ? 'bg-orange-100 dark:bg-orange-900/40' : ''}
            ${investment.type === 'funds' ? 'bg-purple-100 dark:bg-purple-900/40' : ''}
            ${investment.type === 'real_estate' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}
          `}>
            {typeInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {investment.name}
              </h3>
              <span className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                {formatCurrency(currentValue)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t(`investments.types.${investment.type}`)} • {daysHeld}d
              </span>
              <span className={`text-sm font-medium ${growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {growth >= 0 ? '+' : ''}{formatCurrency(growth)} ({growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(2)}%)
              </span>
            </div>
            {investment.expectedReturn > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {investment.returnType === 'cdi' && `${(investment.expectedReturn * 100).toFixed(0)}% CDI`}
                {investment.returnType === 'annual' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'a.a.' : 'p.a.'}`}
                {investment.returnType === 'monthly' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'a.m.' : 'p.m.'}`}
                {investment.returnType === 'total' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'total' : 'total'}`}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-4 sm:inset-8 lg:inset-16 bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Investimentos' : 'Investments'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 sm:p-4">
              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Total Investido' : 'Total Invested'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalInvested)}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3 sm:p-4">
              <p className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Valor Atual' : 'Current Value'}
              </p>
              <p className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(totalValue)}
              </p>
            </div>
            <div className={`rounded-xl p-3 sm:p-4 ${totalGrowth >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30'}`}>
              <p className={`text-xs uppercase tracking-wide mb-1 ${totalGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {language === 'pt' ? 'Rendimento' : 'Growth'}
              </p>
              <p className={`text-lg sm:text-xl font-bold ${totalGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalGrowth >= 0 ? '+' : ''}{formatCurrency(totalGrowth)}
              </p>
            </div>
            <div className={`rounded-xl p-3 sm:p-4 ${totalGrowthPercent >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30'}`}>
              <p className={`text-xs uppercase tracking-wide mb-1 ${totalGrowthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {language === 'pt' ? 'Rentabilidade' : 'Return %'}
              </p>
              <p className={`text-lg sm:text-xl font-bold ${totalGrowthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalGrowthPercent >= 0 ? '+' : ''}{totalGrowthPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="p-4 sm:px-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Type */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-4 h-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
              >
                <option value="all">{language === 'pt' ? 'Todos os tipos' : 'All types'}</option>
                {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {t(`investments.types.${key}`)} ({totalsByType[key]?.count || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500"
              >
                <option value="value">{language === 'pt' ? 'Valor' : 'Value'}</option>
                <option value="growth">{language === 'pt' ? 'Rendimento %' : 'Growth %'}</option>
                <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                <option value="name">{language === 'pt' ? 'Nome' : 'Name'}</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title={sortOrder === 'desc' ? (language === 'pt' ? 'Maior primeiro' : 'Highest first') : (language === 'pt' ? 'Menor primeiro' : 'Lowest first')}
              >
                <svg className={`w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Results count */}
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
              {sortedInvestments.length} {language === 'pt' ? 'investimentos' : 'investments'}
            </span>
          </div>
        </div>

        {/* Investments List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-8 h-8 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : sortedInvestments.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="font-medium text-gray-900 dark:text-white mb-1">
                {filterType !== 'all'
                  ? (language === 'pt' ? 'Nenhum investimento deste tipo' : 'No investments of this type')
                  : (language === 'pt' ? 'Nenhum investimento' : 'No investments')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'pt' ? 'Adicione investimentos pelo botão +' : 'Add investments using the + button'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedInvestments.map((investment) => (
                <InvestmentItem key={investment.id} investment={investment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
