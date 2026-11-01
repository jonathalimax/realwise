/** Content for chat-led onboarding: the categories a new user starts with, the bank list, and the scripted welcome. */

import { BASIC_CATEGORIES } from '../categories/catalog';

export interface DefaultCategory {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

/** The basic categories of the catalog (categories/catalog.ts): what a new account starts with. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = BASIC_CATEGORIES.map((c) => ({ name: c.pt, type: c.type, color: c.color, icon: c.icon }));

/** Same ids as the web app's bank list (apps/web/src/contexts/CardsContext.jsx), so icons and names resolve there. */
export const BANKS: { id: string; name: string }[] = [
  { id: 'nubank', name: 'Nubank' },
  { id: 'itau', name: 'Itaú' },
  { id: 'bradesco', name: 'Bradesco' },
  { id: 'santander', name: 'Santander' },
  { id: 'bb', name: 'Banco do Brasil' },
  { id: 'caixa', name: 'Caixa' },
  { id: 'inter', name: 'Inter' },
  { id: 'c6', name: 'C6 Bank' },
  { id: 'btg', name: 'BTG Pactual' },
  { id: 'xp', name: 'XP' },
  { id: 'picpay', name: 'PicPay' },
  { id: 'mercadopago', name: 'Mercado Pago' },
  { id: 'neon', name: 'Neon' },
  { id: 'next', name: 'Next' },
  { id: 'original', name: 'Banco Original' },
  { id: 'pan', name: 'Banco Pan' },
  { id: 'astropay', name: 'AstroPay' },
  { id: 'other', name: 'Outro' },
];
export const BANK_IDS = BANKS.map((b) => b.id);

export const ACCOUNT_TYPES = ['checking', 'credit', 'wallet', 'savings'] as const;

/** Goal chips offered by the welcome. The first question is about what the person wants, never about money amounts. */
export const WELCOME_GOALS: Record<'pt' | 'en', string[]> = {
  pt: ['Organizar meu mês', 'Juntar uma reserva', 'Quitar dívidas', 'Realizar um sonho', 'Entender para onde vai meu dinheiro', 'Como o Realwise funciona?'],
  en: ['Get my month in order', 'Build an emergency fund', 'Pay off debt', 'Save for a dream', 'See where my money goes'],
};

/** Fallback welcome (the Portuguese one normally comes from the `welcome` snippet in the database). Scripted: no model call. */
export function welcomeMessage(lang: 'pt' | 'en'): { content: string } {
  if (lang === 'en') {
    return {
      content: `Hi! I'm Elio, your financial assistant 💜 I'm here to give you clarity about your money, with no spreadsheets and no hassle.

I already set up your categories. To start, just one question: **what do you want most from your finances right now?** Tap an option or tell me in your own words, typing or using the mic.`,
    };
  }
  return {
    content: `Oi! Eu sou o Elio, seu assistente financeiro 💜 Estou aqui para te dar clareza sobre o seu dinheiro, sem planilha e sem burocracia.

Já deixei as suas categorias prontas. Para começar, só uma pergunta: **o que você mais quer da sua vida financeira agora?** Toque numa opção ou me conte do seu jeito, digitando ou falando.`,
  };
}
