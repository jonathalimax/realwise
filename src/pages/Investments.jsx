import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCards } from '../contexts/CardsContext';
import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function InvestmentsPage() {
  const navigate = useNavigate();
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
  const { getBankInfo, getBankColor } = useCards();

  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, closed
  const [filterBank, setFilterBank] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value'); // value, growth, date, name
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  const handleInvestmentClick = (investment) => {
    navigate(`/investments/${investment.id}/edit`);
  };

  const handleOpenAdd = () => {
    navigate('/investments/new');
  };

  // Filter investments
  const filteredInvestments = investments.filter(inv => {
    // Filter by type
    if (filterType !== 'all' && inv.type !== filterType) return false;

    // Filter by status (active/closed based on maturity date and if it's still held)
    if (filterStatus === 'active') {
      const maturityDate = inv.maturityDate ? new Date(inv.maturityDate) : null;
      if (maturityDate && maturityDate < new Date()) return false;
    } else if (filterStatus === 'closed') {
      const maturityDate = inv.maturityDate ? new Date(inv.maturityDate) : null;
      if (!maturityDate || maturityDate >= new Date()) return false;
    }

    // Filter by bank
    if (filterBank !== 'all' && inv.bank !== filterBank) return false;

    // Filter by search query
    if (searchQuery && !inv.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
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
      case 'date': {
        const dateA = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt?.toDate?.() || new Date(0));
        const dateB = b.purchaseDate ? new Date(b.purchaseDate) : (b.createdAt?.toDate?.() || new Date(0));
        compare = dateA - dateB;
        break;
      }
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

  // Get available banks from investments
  const availableBanks = [...new Set(investments.filter(inv => inv.bank).map(inv => inv.bank))];

  // Count active filters
  const activeFiltersCount = [
    filterType !== 'all',
    filterStatus !== 'all',
    filterBank !== 'all',
    searchQuery !== ''
  ].filter(Boolean).length;

  const InvestmentItem = ({ investment }) => {
    const typeInfo = getInvestmentType(investment.type);
    const currentValue = getCurrentValue(investment);
    const growthPercent = getGrowthPercentage(investment);
    const growth = currentValue - (investment.initialAmount || 0);
    const daysHeld = getDaysHeld(investment);

    // Get bank info if bank is linked
    // Check if the bank matches a known bank ID, otherwise use it as a custom name
    const knownBankInfo = investment.bank ? getBankInfo(investment.bank) : null;
    const isKnownBank = knownBankInfo && knownBankInfo.id !== 'other';
    const bankColor = isKnownBank ? getBankColor(investment.bank) : { light: 'bg-gray-100', bg: 'bg-gray-500', text: 'text-gray-600' };
    const bankDisplayName = isKnownBank ? knownBankInfo.name : investment.bank;
    const bankIcon = isKnownBank ? knownBankInfo.icon : '🏦';

    // Format dates
    const purchaseDate = investment.purchaseDate ? new Date(investment.purchaseDate).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    const maturityDate = investment.maturityDate ? new Date(investment.maturityDate).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

    return (
      <button
        onClick={() => handleInvestmentClick(investment)}
        className="w-full bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer text-left"
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0
            ${investment.type === 'fixed_income' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}
            ${investment.type === 'stocks' ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}
            ${investment.type === 'crypto' ? 'bg-orange-100 dark:bg-orange-900/40' : ''}
            ${investment.type === 'funds' ? 'bg-purple-100 dark:bg-purple-900/40' : ''}
            ${investment.type === 'real_estate' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}
          `}>
            {typeInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            {/* Header: Name + Type Badge */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                {investment.name}
              </h3>
              <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full flex-shrink-0
                ${investment.type === 'fixed_income' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : ''}
                ${investment.type === 'stocks' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : ''}
                ${investment.type === 'crypto' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : ''}
                ${investment.type === 'funds' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : ''}
                ${investment.type === 'real_estate' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : ''}
              `}>
                {t(`investments.types.${investment.type}`)}
              </span>
            </div>

            {/* Bank Info */}
            {investment.bank && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-4 h-4 sm:w-5 sm:h-5 ${bankColor.light} dark:bg-opacity-30 rounded flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0`}>
                  {bankIcon}
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                  {bankDisplayName}
                </span>
              </div>
            )}

            {/* Values Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('investments.initialAmount')}</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(investment.initialAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('investments.currentAmount')}</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(currentValue)}</p>
              </div>
            </div>

            {/* Profit/Loss */}
            <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-2 ${growth >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30'}`}>
              <span className={`text-[10px] sm:text-xs font-medium ${growth >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {growth >= 0 ? (language === 'pt' ? 'Lucro' : 'Profit') : (language === 'pt' ? 'Prejuízo' : 'Loss')}
              </span>
              <span className={`text-xs sm:text-sm font-bold ${growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {growth >= 0 ? '+' : ''}{formatCurrency(growth)} ({growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(2)}%)
              </span>
            </div>

            {/* Return Rate & Dates */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
              {investment.expectedReturn > 0 && (
                <span className="font-medium">
                  {investment.returnType === 'cdi' && `${(investment.expectedReturn * 100).toFixed(0)}% CDI`}
                  {investment.returnType === 'annual' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'a.a.' : 'p.a.'}`}
                  {investment.returnType === 'monthly' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'a.m.' : 'p.m.'}`}
                  {investment.returnType === 'total' && `${(investment.expectedReturn * 100).toFixed(2)}% ${language === 'pt' ? 'total' : 'total'}`}
                </span>
              )}
              {purchaseDate && (
                <>
                  <span>•</span>
                  <span>{purchaseDate}</span>
                </>
              )}
              {maturityDate && (
                <>
                  <span>•</span>
                  <span className="font-medium">{language === 'pt' ? 'Vcto' : 'Mat'}: {maturityDate}</span>
                </>
              )}
              <span>•</span>
              <span>{daysHeld}d</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Investimentos' : 'Investments'}
            </h1>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{language === 'pt' ? 'Adicionar' : 'Add'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8 pt-4 space-y-4 sm:space-y-6">
        {/* Beautiful Summary Header */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg">
          {/* Main Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-blue-100 dark:text-blue-200 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Investido' : 'Invested'}
              </p>
              <p className="text-base sm:text-xl font-bold text-white truncate">
                {formatCurrency(totalInvested)}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-blue-100 dark:text-blue-200 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Valor Atual' : 'Current Value'}
              </p>
              <p className="text-base sm:text-xl font-bold text-white truncate">
                {formatCurrency(totalValue)}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-blue-100 dark:text-blue-200 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Rendimento' : 'Profit/Loss'}
              </p>
              <p className={`text-base sm:text-xl font-bold truncate ${totalGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {totalGrowth >= 0 ? '+' : ''}{formatCurrency(totalGrowth)}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-blue-100 dark:text-blue-200 uppercase tracking-wide mb-1">
                {language === 'pt' ? 'Rentabilidade' : 'Return'}
              </p>
              <p className={`text-base sm:text-xl font-bold truncate ${totalGrowthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {totalGrowthPercent >= 0 ? '+' : ''}{totalGrowthPercent.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Count Badge */}
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
              <p className="text-xs sm:text-sm text-white font-medium">
                {investments.length} {investments.length === 1
                  ? (language === 'pt' ? 'investimento' : 'investment')
                  : (language === 'pt' ? 'investimentos' : 'investments')}
              </p>
            </div>
            {totalGrowth >= 0 && totalGrowthPercent > 0 && (
              <div className="px-3 py-1.5 bg-emerald-500/30 backdrop-blur-sm rounded-full flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-xs sm:text-sm text-emerald-100 font-medium">
                  {language === 'pt' ? 'Crescendo' : 'Growing'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Filters Bar */}
        <div className="flex items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'pt' ? 'Buscar investimentos...' : 'Search investments...'}
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                showFilters ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 sm:p-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            {/* Investment Type Pills */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {language === 'pt' ? 'Tipo de Investimento' : 'Investment Type'}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    filterType === 'all'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {language === 'pt' ? 'Todos' : 'All'} ({investments.length})
                </button>
                {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setFilterType(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                      filterType === key
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span>{info.icon}</span>
                    <span>{t(`investments.types.${key}`)}</span>
                    <span className={`${filterType === key ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                      ({totalsByType[key]?.count || 0})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Status Pills */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {language === 'pt' ? 'Status' : 'Status'}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: language === 'pt' ? 'Todos' : 'All' },
                  { value: 'active', label: language === 'pt' ? 'Ativos' : 'Active' },
                  { value: 'closed', label: language === 'pt' ? 'Encerrados' : 'Closed' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterStatus(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      filterStatus === option.value
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bank Filter */}
            {availableBanks.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Banco / Plataforma' : 'Bank / Platform'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterBank('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      filterBank === 'all'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {language === 'pt' ? 'Todos' : 'All'}
                  </button>
                  {availableBanks.map(bankValue => {
                    const knownBank = getBankInfo(bankValue);
                    const isKnown = knownBank && knownBank.id !== 'other';
                    const displayName = isKnown ? knownBank.name : bankValue;
                    const icon = isKnown ? knownBank.icon : '🏦';
                    return (
                      <button
                        key={bankValue}
                        onClick={() => setFilterBank(bankValue)}
                        className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                          filterBank === bankValue
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{displayName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sort Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordenar por' : 'Sort by'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'value', label: language === 'pt' ? 'Valor' : 'Value' },
                    { value: 'growth', label: language === 'pt' ? 'Rentabilidade' : 'Growth' },
                    { value: 'date', label: language === 'pt' ? 'Data' : 'Date' },
                    { value: 'name', label: language === 'pt' ? 'Nome' : 'Name' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        sortBy === option.value
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordem' : 'Order'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortOrder('desc')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                      sortOrder === 'desc'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {language === 'pt' ? 'Maior' : 'Highest'}
                  </button>
                  <button
                    onClick={() => setSortOrder('asc')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                      sortOrder === 'asc'
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {language === 'pt' ? 'Menor' : 'Lowest'}
                  </button>
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterStatus('all');
                  setFilterBank('all');
                  setSearchQuery('');
                }}
                className="w-full py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {sortedInvestments.length} {sortedInvestments.length === 1
              ? (language === 'pt' ? 'investimento' : 'investment')
              : (language === 'pt' ? 'investimentos' : 'investments')}
            {activeFiltersCount > 0 && (
              <span className="ml-1 text-gray-500 dark:text-gray-500">
                ({language === 'pt' ? 'filtrado' : 'filtered'})
              </span>
            )}
          </p>
        </div>

        {/* Investments List */}
        <div className="flex-1">
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
