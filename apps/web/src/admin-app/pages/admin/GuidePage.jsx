import { useState, useMemo } from 'react';
import guideData from './guideData';
import EmailGuide from './EmailGuide';

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [openItems, setOpenItems] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const filteredData = useMemo(() => {
    const search = searchQuery.toLowerCase();

    if (!search) {
      // Sem busca: filtra por aba
      if (activeTab === 'all' || activeTab === 'emails') return guideData;
      return guideData.filter(section => section.id === activeTab);
    }

    // Com busca: procura em todas as seções e itens
    const results = guideData
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.title.toLowerCase().includes(search) ||
          item.content.toLowerCase().includes(search)
        ),
      }))
      .filter(section => section.items.length > 0);

    return results;
  }, [searchQuery, activeTab]);

  const toggleItem = (itemId) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(itemId)) {
      newOpen.delete(itemId);
    } else {
      newOpen.add(itemId);
    }
    setOpenItems(newOpen);
  };

  const copyToClipboard = (text, itemId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-emerald-400 mb-2">Central de Ajuda</h1>
          <p className="text-gray-400">Tudo que você precisa saber sobre o Realwise para explicar aos clientes</p>
        </div>

        {/* Barra de Busca */}
        <div className="mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400">🔍</span>
            <input
              type="text"
              placeholder="Buscar em toda a central de ajuda..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && activeTab !== 'emails') setActiveTab('all');
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Abas */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scroll-smooth">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-emerald-500 text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Tudo
          </button>
          {guideData.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === section.id
                  ? 'bg-emerald-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {section.label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'emails' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            E-mails
          </button>
        </div>

        {activeTab === 'emails' && <EmailGuide query={searchQuery} />}

        {/* Conteúdo */}
        <div className={`space-y-6 ${activeTab === 'emails' ? 'hidden' : ''}`}>
          {filteredData.map(section => (
            <div key={section.id}>
              {/* Cabeçalho da seção */}
              <div className={`text-xs font-bold letter-spacing tracking-wider mb-3 ${section.color}`}>
                {section.label}
              </div>

              {/* Items */}
              <div className="space-y-2">
                {section.items.map(item => (
                  <div
                    key={item.id}
                    className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900 hover:border-gray-600 transition-colors"
                  >
                    {/* Header do Acordeão */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-100">{item.title}</span>
                      <span className={`text-emerald-400 transition-transform duration-200 flex-shrink-0 ${openItems.has(item.id) ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {/* Body do Acordeão */}
                    {openItems.has(item.id) && (
                      <div className="border-t border-gray-700 bg-gray-800/50 p-4 animate-in fade-in duration-200">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap mb-4 leading-relaxed">
                          {item.content}
                        </p>
                        <button
                          onClick={() => copyToClipboard(item.content, item.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg text-sm transition-colors"
                        >
                          {copiedId === item.id ? '✅ Copiado!' : '📋 Copiar resposta'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Mensagem se nenhum resultado */}
          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">Nenhum resultado para "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
