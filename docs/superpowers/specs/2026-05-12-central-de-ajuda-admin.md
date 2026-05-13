# Spec: Central de Ajuda — Admin

**Data:** 2026-05-12  
**Rota:** `/admin/guia`  
**Público-alvo:** Equipe interna (esposa do fundador) para consulta e envio de respostas a clientes interessados

---

## Objetivo

Página no painel admin que centraliza todo o conhecimento do Realwise em português BR: o que é, quanto custa, funcionalidades, processo de onboarding, tutoriais de uso e mensagens prontas para copiar e enviar a potenciais clientes via WhatsApp ou qualquer canal.

---

## Layout

**Abas + Acordeão** com barra de busca global no topo.

```
┌─────────────────────────────────────────────────┐
│  🔍 Buscar em toda a central de ajuda...         │
├─────────────────────────────────────────────────┤
│ Tudo │ 📌 O que é │ 💰 Preço │ ⚙️ Funcionalidades │
│ 🎓 Onboarding │ 📱 Como usar │ 💬 Msgs prontas │ 🆘 Suporte │
├─────────────────────────────────────────────────┤
│ 📌 O QUE É                                       │
│  ▼ O que é o Realwise? .............. [Copiar]  │
│  ▶ Para quem é indicado?                         │
│                                                  │
│ 💰 PREÇO                                         │
│  ▶ Quanto custa?                                 │
│  ▶ Tem mensalidade?                              │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

- Barra de busca filtra itens em tempo real (título + corpo do texto)
- Abas filtram por categoria; "Tudo" mostra todas as seções
- Cada item é um acordeão colapsável
- Botão "📋 Copiar" copia o texto puro para o clipboard
- Mobile-friendly: abas com scroll horizontal, acordeões full-width

---

## Seções e Conteúdo

### 1. 📌 O que é
| Item | Conteúdo |
|------|----------|
| O que é o Realwise? | App de finanças pessoais, pagamento único, funciona no celular e no PC, dados no Firebase próprio do cliente |
| Para quem é indicado? | Pessoas que querem controle real do dinheiro sem assinar mais um serviço por mês |
| O que torna diferente? | Sem mensalidade, dados 100% do usuário (não ficam no nosso servidor), suporte vitalício |
| Os dados ficam seguros? | Cada cliente tem seu próprio Firebase isolado — nós não temos acesso aos dados financeiros |

### 2. 💰 Preço
| Item | Conteúdo |
|------|----------|
| Quanto custa? | Pagamento único: R$479,88 à vista ou 12x de R$39,99 |
| Tem mensalidade? | Não. Paga uma vez, usa para sempre. Sem renovação anual. |
| O que está incluído? | Dashboard, transações, contas a pagar, cartões, importação de extrato, planejador, orçamento, carteira de investimentos, suporte vitalício, segurança |
| Novas funcionalidades custam mais? | Correções e melhorias são gratuitas. Novas funcionalidades maiores são upgrades opcionais — o cliente decide se quer e paga só pelo que usar |
| Como funciona o pagamento? | Pelo site, via cartão de crédito (Stripe) — seguro e parcelado em até 12x |

### 3. ⚙️ Funcionalidades
| Item | Conteúdo |
|------|----------|
| Dashboard | Visão geral do mês: saldo, entradas, saídas, gráfico por categoria |
| Transações | Cadastro manual ou importação automática de extrato bancário (Nubank, Itaú, Bradesco) |
| Contas a pagar | Gerenciamento de contas recorrentes com lembretes por e-mail |
| Cartões de crédito | Controle de faturas e gastos por cartão |
| Planejador | Planner de renda, alocação e carteira de investimentos |
| Orçamento | Limite mensal por categoria com acompanhamento em tempo real |
| Carteira de investimentos | Registro manual e sincronização com a B3 |
| Importação de extrato | Upload de arquivo CSV/OFX dos bancos principais com categorização automática |
| PWA (app no celular) | Pode instalar como app no iPhone ou Android direto do navegador, sem loja de apps |

### 4. 🎓 Onboarding — Do Pagamento ao Uso
Passo a passo cronológico:

1. **Compra** — acessa o site, clica em comprar, paga pelo Stripe (cartão, até 12x)
2. **Recebe e-mail** — confirmação de compra com link de acesso e próximos passos
3. **Configuração inicial** — equipe Realwise cria o ambiente Firebase exclusivo do cliente (acontece em até 24h úteis)
4. **Credenciais de acesso** — cliente recebe e-mail com link de login e senha temporária
5. **Primeiro login** — acessa `realwise.com.br/{clientId}/login`, define nova senha
6. **Onboarding guiado** — wizard interno de 3 passos: adicionar banco, cadastrar primeira transação, configurar orçamento
7. **Uso diário** — app pronto para usar; suporte disponível em `suporte@realwise.com.br`

### 5. 📱 Como usar / Tutoriais
| Item | Conteúdo |
|------|----------|
| Acessar no celular | Abrir `realwise.com.br/{clientId}/login` no navegador do celular → fazer login |
| Instalar como app (PWA) no iPhone | Safari → botão compartilhar (quadrado com seta) → "Adicionar à Tela de Início" → aparece como app |
| Instalar como app (PWA) no Android | Chrome → menu (três pontos) → "Adicionar à tela inicial" → instalar |
| Acessar no computador | Abrir qualquer navegador, digitar `realwise.com.br/{clientId}/login` |
| Esqueci minha senha | Na tela de login, clicar em "Esqueci minha senha" → e-mail de redefinição |
| Trocar idioma / moeda | Menu → Configurações → Geral |

### 6. 💬 Mensagens Prontas
Mensagens com tom humano para copiar e enviar. Cada uma tem tag de canal sugerido (WhatsApp / E-mail).

| Mensagem | Canal | Quando usar |
|----------|-------|-------------|
| Apresentação inicial | WhatsApp | Primeiro contato com interessado |
| Resposta sobre preço | WhatsApp | Quando perguntam quanto custa |
| Resposta sobre mensalidade | WhatsApp | Quando perguntam "tem mensalidade?" |
| Resposta sobre segurança dos dados | WhatsApp | Quando perguntam onde ficam os dados |
| Resposta sobre o que inclui | WhatsApp | Quando perguntam o que vem no plano |
| Envio do link de compra | WhatsApp | Quando o cliente decide comprar |
| Boas-vindas pós-compra | E-mail/WhatsApp | Após confirmação do pagamento |
| Acompanhamento pós-onboarding | WhatsApp | 1 semana após o cliente ativar |

### 7. 🆘 Suporte
| Item | Conteúdo |
|------|----------|
| Como entrar em contato | E-mail: `suporte@realwise.com.br` · WhatsApp: (a definir) |
| Tempo de resposta | Até 24h úteis pelo e-mail |
| O que o suporte resolve | Dúvidas de uso, problemas de acesso, importação de extrato, erros no app |
| O que o suporte não resolve | Problemas no banco do cliente, conexão de internet, dispositivo do usuário |

---

## Componente: `GuidePage.jsx`

**Arquivo:** `src/pages/admin/GuidePage.jsx`

**Estrutura interna:**
- `guideData.js` — objeto com todas as seções, itens, textos e tags de canal (fonte única de verdade para o conteúdo)
- `GuidePage.jsx` — renderiza busca, abas e acordeões a partir de `guideData`
- Sem estado persistente no Firestore — conteúdo é estático no código

**Estado local:**
- `searchQuery` — texto da busca (filtra título + corpo)
- `activeTab` — aba selecionada (`'all' | 'o-que-e' | 'preco' | ...`)
- `openItems` — Set de ids dos acordeões abertos

**Comportamento da busca:**
- Filtra em tempo real sem debounce (dados locais, sem rede)
- Quando há texto na busca, a aba "Tudo" é ativada automaticamente
- Resultados sem match são ocultados; seções vazias também somem

**Botão copiar:**
- Usa `navigator.clipboard.writeText(text)`
- Ícone muda para ✅ por 2s após cópia (feedback visual)
- Copia somente o texto puro (sem markdown, sem emojis de UI)

**Roteamento:**
- Nova rota em `AdminApp.jsx`: `<Route path="guia" element={<GuidePage />} />`
- Link "Guia" adicionado ao `<nav>` do admin

---

## Responsividade

- **Mobile:** abas com `overflow-x: auto` e `white-space: nowrap`; acordeões full-width
- **Desktop:** layout igual, conteúdo centralizado com `max-w-4xl`
- Tema escuro nativo (segue o padrão `bg-gray-950` do admin)

---

## Fora de escopo

- Edição de conteúdo via UI (conteúdo é estático no código por ora)
- Autoria/versionamento de mensagens
- Analytics de quais mensagens são mais copiadas
- Integração com WhatsApp Business API
