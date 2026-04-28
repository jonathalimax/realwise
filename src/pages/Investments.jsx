import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import { analytics } from '../services/analyticsService';
import { auth } from '../firebase';
import { useSettings } from '../contexts/SettingsContext';
import { useCards } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import CarteiraTab from './planner/carteira';
import usePlannerState from './planner/usePlannerState';

function SubTabs({ active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
      {[
        { value: 'plano', label: 'Plano' },
        { value: 'lista', label: 'Lista' },
      ].map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${
            active === t.value
              ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const BADGE_COLORS = {
  fixed_income: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  stocks: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  crypto: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  funds: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  fii: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  real_estate: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
};

export default function InvestmentsPage() {
  const navigate = useNavigate();
  const { selectedMonth } = useMonth();
  const {
    investments,
    loading,
    getTotalInvested,
    getInvestmentType,
  } = useInvestments();
  const { formatCurrency, t, language } = useSettings();
  const { getBankInfo } = useCards();
  const { state, update, poupancaValue, isLoading: plannerLoading } = usePlannerState();

  const [activeSubTab, setActiveSubTab] = useState('plano');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && investments.length === 0) {
      analytics.emptyStateVisited(auth.currentUser?.uid, { tab: 'investments' });
    }
  }, [loading, investments.length]);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  const handleInvestmentClick = (investment) => {
    navigate(`/investments/${investment.id}/edit`);
  };

  const filteredInvestments = investments.filter(inv => {
    if (filterType !== 'all' && inv.type !== filterType) return false;
    if (searchQuery && !inv.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedInvestments = [...filteredInvestments].sort((a, b) => {
    let compare = 0;
    if (sortBy === 'amount') {
      compare = (a.initialAmount || 0) - (b.initialAmount || 0);
    } else if (sortBy === 'date') {
      const dateA = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt?.toDate?.() || new Date(0));
      const dateB = b.purchaseDate ? new Date(b.purchaseDate) : (b.createdAt?.toDate?.() || new Date(0));
      compare = dateA - dateB;
    } else if (sortBy === 'name') {
      compare = (a.name || '').localeCompare(b.name || '');
    }
    return sortOrder === 'desc' ? -compare : compare;
  });

  const totalInvested = getTotalInvested();

  const totalsByType = Object.keys(INVESTMENT_TYPES).reduce((acc, type) => {
    const typeInvestments = investments.filter(inv => inv.type === type);
    acc[type] = {
      count: typeInvestments.length,
      value: typeInvestments.reduce((sum, inv) => sum + (inv.initialAmount || 0), 0),
    };
    return acc;
  }, {});

  const activeFiltersCount = [filterType !== 'all', searchQuery !== ''].filter(Boolean).length;

  const InvestmentItem = ({ investment }) => {
    const typeInfo = getInvestmentType(investment.type);
    const knownBankInfo = investment.bank ? getBankInfo(investment.bank) : null;
    const isKnownBank = knownBankInfo && knownBankInfo.id !== 'other';
    const bankDisplayName = isKnownBank ? knownBankInfo.name : investment.bank;
    const bankIcon = isKnownBank ? knownBankInfo.icon : '🏦';

    const purchaseDate = investment.purchaseDate
      ? new Date(investment.purchaseDate).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    return (
      <button
        onClick={() => handleInvestmentClick(investment)}
        className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0
            ${investment.type === 'fixed_income' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}
            ${investment.type === 'stocks' ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}
            ${investment.type === 'crypto' ? 'bg-orange-100 dark:bg-orange-900/40' : ''}
            ${investment.type === 'funds' ? 'bg-purple-100 dark:bg-purple-900/40' : ''}
            ${investment.type === 'real_estate' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}
            ${investment.type === 'fii' ? 'bg-teal-100 dark:bg-teal-900/40' : ''}
          `}>
            {typeInfo.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{investment.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${BADGE_COLORS[investment.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {t(`investments.types.${investment.type}`)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {investment.bank && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{bankIcon}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{bankDisplayName}</span>
                  </div>
                )}
                {purchaseDate && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{purchaseDate}</span>
                )}
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                {formatCurrency(investment.initialAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title={language === 'pt' ? 'Investimentos' : 'Investments'} />

      <div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8 pt-4 space-y-4">
        {/* Summary card */}
        <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
            {language === 'pt' ? 'Total investido' : 'Total invested'}
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(totalInvested)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {investments.length} {investments.length === 1
              ? (language === 'pt' ? 'ativo' : 'asset')
              : (language === 'pt' ? 'ativos' : 'assets')}
          </p>
        </div>

        {/* Subtabs */}
        <SubTabs active={activeSubTab} onChange={setActiveSubTab} />

        {/* ── Plano tab ── */}
        {activeSubTab === 'plano' && !plannerLoading && (
          <CarteiraTab
            state={state}
            update={update}
            poupancaValue={poupancaValue}
            selectedMonth={selectedMonth}
          />
        )}

        {/* ── Lista tab ── */}
        {activeSubTab === 'lista' && (
          <>
            {/* Type breakdown */}
            {Object.entries(INVESTMENT_TYPES).some(([key]) => totalsByType[key]?.count > 0) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(INVESTMENT_TYPES)
                  .filter(([key]) => totalsByType[key]?.count > 0)
                  .map(([key, info]) => (
                    <div key={key} className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700 text-center min-w-[80px]">
                      <p className="text-lg mb-0.5">{info.icon}</p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalsByType[key].value)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{t(`investments.types.${key}`)}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'pt' ? 'Buscar...' : 'Search...'}
                  className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0 border ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                }`}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                {activeFiltersCount > 0 && (
                  <span className="text-xs font-bold">{activeFiltersCount}</span>
                )}
              </button>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    {language === 'pt' ? 'Tipo' : 'Type'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                    >
                      {language === 'pt' ? 'Todos' : 'All'} ({investments.length})
                    </button>
                    {Object.entries(INVESTMENT_TYPES).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setFilterType(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${filterType === key ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                      >
                        <span>{info.icon}</span>
                        <span>{t(`investments.types.${key}`)}</span>
                        <span className={filterType === key ? 'text-white/80' : 'text-gray-500'}>({totalsByType[key]?.count || 0})</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      {language === 'pt' ? 'Ordenar' : 'Sort'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'date', label: language === 'pt' ? 'Data' : 'Date' },
                        { value: 'amount', label: language === 'pt' ? 'Valor' : 'Amount' },
                        { value: 'name', label: language === 'pt' ? 'Nome' : 'Name' },
                      ].map(o => (
                        <button key={o.value} onClick={() => setSortBy(o.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === o.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      {language === 'pt' ? 'Ordem' : 'Order'}
                    </label>
                    <div className="flex gap-2">
                      {[{ value: 'desc', label: language === 'pt' ? 'Maior' : 'Highest' }, { value: 'asc', label: language === 'pt' ? 'Menor' : 'Lowest' }].map(o => (
                        <button key={o.value} onClick={() => setSortOrder(o.value)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${sortOrder === o.value ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                    className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    {language === 'pt' ? 'Limpar filtros' : 'Clear filters'}
                  </button>
                )}
              </div>
            )}

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin w-8 h-8 text-gray-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : sortedInvestments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">💼</p>
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  {filterType !== 'all' || searchQuery
                    ? (language === 'pt' ? 'Nenhum resultado' : 'No results')
                    : (language === 'pt' ? 'Nenhum investimento' : 'No investments yet')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                  {sortedInvestments.length} {sortedInvestments.length === 1
                    ? (language === 'pt' ? 'investimento' : 'investment')
                    : (language === 'pt' ? 'investimentos' : 'investments')}
                  {activeFiltersCount > 0 && ` · ${language === 'pt' ? 'filtrado' : 'filtered'}`}
                </p>
                {sortedInvestments.map((investment) => (
                  <InvestmentItem key={investment.id} investment={investment} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/investments/new')}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label={language === 'pt' ? 'Novo Investimento' : 'New Investment'}
      >
        <PlusIcon className="w-7 h-7" />
      </button>
      <PageHelp
        title="Investimentos"
        text="Organize seus investimentos em Camadas e Sublayers. Camada = objetivo (ex: Proteção, Crescimento). Sublayer = produto real (ex: CDB, Tesouro Selic). Defina o % de cada camada no Plano e adicione os ativos reais na Lista."
        hasFab={true}
      />
    </div>
  );
}
