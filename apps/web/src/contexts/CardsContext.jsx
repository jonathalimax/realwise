import { createContext, useContext, useState, useEffect } from 'react';
import { useAccess } from './AccessContext';
import { billsResource, notifyBillsChanged } from '../lib/api/resources/bills';
import { accountsResource } from '../lib/api/resources/accounts';

const CardsContext = createContext();

// Brazilian banks list
export const BANKS = [
  { id: 'nubank', name: 'Nubank', icon: '💜', color: 'purple' },
  { id: 'itau', name: 'Itaú', icon: '🧡', color: 'orange' },
  { id: 'bradesco', name: 'Bradesco', icon: '❤️', color: 'rose' },
  { id: 'santander', name: 'Santander', icon: '❤️', color: 'rose' },
  { id: 'bb', name: 'Banco do Brasil', icon: '💛', color: 'amber' },
  { id: 'caixa', name: 'Caixa', icon: '💙', color: 'blue' },
  { id: 'inter', name: 'Inter', icon: '🧡', color: 'orange' },
  { id: 'c6', name: 'C6 Bank', icon: '⬛', color: 'slate' },
  { id: 'btg', name: 'BTG Pactual', icon: '💙', color: 'blue' },
  { id: 'xp', name: 'XP', icon: '🖤', color: 'slate' },
  { id: 'picpay', name: 'PicPay', icon: '💚', color: 'emerald' },
  { id: 'mercadopago', name: 'Mercado Pago', icon: '💙', color: 'cyan' },
  { id: 'neon', name: 'Neon', icon: '💙', color: 'cyan' },
  { id: 'next', name: 'Next', icon: '💚', color: 'emerald' },
  { id: 'original', name: 'Banco Original', icon: '💚', color: 'emerald' },
  { id: 'pan', name: 'Banco Pan', icon: '💙', color: 'blue' },
  { id: 'astropay', name: 'AstroPay', icon: '💜', color: 'purple' },
  { id: 'other', name: 'Outro', icon: '🏦', color: 'slate' },
];

// Color classes for banks
export const BANK_COLORS = {
  purple: { bg: 'bg-purple-600', light: 'bg-purple-100', text: 'text-purple-600' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600' },
  rose: { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-600' },
  amber: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600' },
  blue: { bg: 'bg-blue-600', light: 'bg-blue-100', text: 'text-blue-600' },
  slate: { bg: 'bg-slate-700', light: 'bg-slate-100', text: 'text-slate-700' },
  emerald: { bg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-600' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-600' },
};

export function CardsProvider({ children }) {
  const [userBanks, setUserBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  useEffect(() => {
    if (!ownerId) {
      setUserBanks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    accountsResource.list()
      .then((banksData) => {
        const sorted = [...banksData].sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateA - dateB;
        });
        setUserBanks(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Accounts query error:', err);
        setUserBanks([]);
        setLoading(false);
      });
  }, [ownerId]);

  // Helper function to create a bill for a credit card
  const createBillForCreditCard = async (bankData, bankDocId) => {
    if (!bankData.hasCredit) return null;

    try {
      const bankInfo = getBankInfo(bankData.bankId);
      const cardDisplayName = bankData.cardName || bankInfo.name;

      // Calculate next due date based on payment day
      const today = new Date();
      const paymentDay = bankData.paymentDay || 15;
      let dueDate = new Date(today.getFullYear(), today.getMonth(), paymentDay);

      // If payment day has passed this month, set to next month
      if (today.getDate() > paymentDay) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      const billData = {
        name: `Fatura ${cardDisplayName}`,
        description: `Fatura do cartão de crédito ${cardDisplayName}`,
        amount: '0',
        category: 'credit_card',
        dueDate: dueDate.toISOString(),
        recurrence: 'monthly',
        recurrenceEndDate: null,
        notificationEnabled: true,
        notificationDaysBefore: 3,
        status: 'pending',
        linkedBankId: bankDocId, // Link to the bank/card
      };

      const bill = await billsResource.create(billData);
      notifyBillsChanged();
      return bill.id;
    } catch (error) {
      console.error('Error creating bill for credit card:', error);
      return null;
    }
  };

  const addBank = async (bankData) => {
    try {
      const newBank = {
        name: bankData.cardName
          || (bankData.bankId === 'other' ? (bankData.customBankName || 'Other') : getBankInfo(bankData.bankId).name),
        type: bankData.hasCredit ? 'credit' : 'checking',
        bankId: bankData.bankId,
        cardName: bankData.cardName,
        customBankName: bankData.bankId === 'other' ? (bankData.customBankName || null) : null,
        hasCredit: bankData.hasCredit || false,
        closingDay: bankData.hasCredit ? (bankData.closingDay || 10) : null,
        paymentDay: bankData.hasCredit ? (bankData.paymentDay || 15) : null,
        balance: '0',
      };

      const created = await accountsResource.create(newBank);
      const docRef = { id: created.id };
      setUserBanks((prev) => [...prev, { ...created }]);

      // Auto-create bill for credit cards (only if one doesn't already exist)
      if (newBank.hasCredit) {
        const existingBills = await billsResource.list();
        const linkedBills = existingBills.filter((bill) => bill.linkedBankId === docRef.id);
        if (linkedBills.length === 0) {
          await createBillForCreditCard(newBank, docRef.id);
        }
      }

      return docRef.id;
    } catch (error) {
      console.error('Error adding bank:', error);
      return null;
    }
  };

  const updateBank = async (docId, updates) => {
    try {
      const currentBank = getUserBankById(docId);

      // Update the bank
      const nextBank = {
        ...updates,
        name: updates.cardName
          || (updates.bankId === 'other'
            ? (updates.customBankName || currentBank?.customBankName || 'Other')
            : getBankInfo(updates.bankId || currentBank?.bankId).name),
        type: updates.hasCredit ? 'credit' : (currentBank?.type || 'checking'),
        cardName: updates.cardName || null,
        customBankName: updates.bankId === 'other' ? (updates.customBankName || null) : null,
      };
      const updated = await accountsResource.update(docId, nextBank);
      setUserBanks((prev) => prev.map((bank) => (bank.id === docId ? updated : bank)));

      // Handle linked bill sync
      // Find any bill linked to this bank
      const existingBills = await billsResource.list();
      const linkedBills = existingBills.filter((bill) => bill.linkedBankId === docId);

      // Check if credit was disabled
      if (updates.hasCredit === false) {
        // Delete linked bill if credit was disabled
        for (const bill of linkedBills) {
          await billsResource.remove(bill.id);
        }
        notifyBillsChanged();
      } else if (updates.hasCredit === true && linkedBills.length === 0) {
        // Create bill if credit was enabled and no bill exists
        const bankData = {
          bankId: updates.bankId || currentBank?.bankId,
          cardName: updates.cardName || currentBank?.cardName,
          hasCredit: true,
          paymentDay: updates.paymentDay || currentBank?.paymentDay || 15
        };
        await createBillForCreditCard(bankData, docId);
      } else if (linkedBills.length > 0 && (currentBank?.hasCredit || updates.hasCredit !== false)) {
        // Update existing bill if card name or payment day changed
        const linkedBill = linkedBills[0];
        const billUpdates = {};

        // Check if card name changed
        const newCardName = updates.cardName !== undefined ? updates.cardName : currentBank?.cardName;
        const oldCardName = currentBank?.cardName;
        const bankInfo = getBankInfo(updates.bankId || currentBank?.bankId);

        if (newCardName !== oldCardName) {
          const cardDisplayName = newCardName || bankInfo.name;
          billUpdates.name = `Fatura ${cardDisplayName}`;
          billUpdates.description = `Fatura do cartão de crédito ${cardDisplayName}`;
        }

        // Check if payment day changed
        const newPaymentDay = updates.paymentDay !== undefined ? updates.paymentDay : currentBank?.paymentDay;
        const oldPaymentDay = currentBank?.paymentDay;

        if (newPaymentDay !== undefined && newPaymentDay !== oldPaymentDay) {
          // Calculate new due date
          const today = new Date();
          let dueDate = new Date(today.getFullYear(), today.getMonth(), newPaymentDay);

          // If payment day has passed this month, set to next month
          if (today.getDate() > newPaymentDay) {
            dueDate.setMonth(dueDate.getMonth() + 1);
          }

          billUpdates.dueDate = dueDate.toISOString().split('T')[0];
        }

        // Apply updates if there are any
        if (Object.keys(billUpdates).length > 0) {
          await billsResource.update(linkedBill.id, billUpdates);
          notifyBillsChanged();
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating bank:', error);
      return false;
    }
  };

  const deleteBank = async (docId) => {
    try {
      const existingBills = await billsResource.list();
      const linkedBills = existingBills.filter((bill) => bill.linkedBankId === docId);

      // Delete all linked bills
      for (const bill of linkedBills) {
        await billsResource.remove(bill.id);
      }
      if (linkedBills.length > 0) notifyBillsChanged();

      // Delete the bank
      await accountsResource.remove(docId);
      setUserBanks((prev) => prev.filter((bank) => bank.id !== docId));
      return true;
    } catch (error) {
      console.error('Error deleting bank:', error);
      return false;
    }
  };

  const getBankInfo = (bankId) => {
    return BANKS.find(b => b.id === bankId) || BANKS.find(b => b.id === 'other');
  };

  // Get display name for a user bank (considers custom bank name and auto-numbers duplicates)
  const getBankDisplayName = (userBank) => {
    if (!userBank) return 'Unknown';

    // If user has a custom card name, use it
    if (userBank.cardName) {
      return userBank.cardName;
    }

    // If it's "other" bank with custom name, use that
    if (userBank.bankId === 'other' && userBank.customBankName) {
      return userBank.customBankName;
    }

    // Get the standard bank name
    const bankInfo = getBankInfo(userBank.bankId);
    const baseName = bankInfo?.name || 'Unknown';

    // Count how many banks of the same type exist without custom names
    const sameBankTypeWithoutName = userBanks.filter(
      b => b.bankId === userBank.bankId && !b.cardName
    );

    // If there's only one, just use the bank name
    if (sameBankTypeWithoutName.length <= 1) {
      return baseName;
    }

    // Otherwise, add a number based on creation order
    const index = sameBankTypeWithoutName.findIndex(b => b.id === userBank.id);
    return index === 0 ? baseName : `${baseName} (${index + 1})`;
  };

  const getBankColor = (bankId) => {
    const bank = getBankInfo(bankId);
    return BANK_COLORS[bank?.color] || BANK_COLORS.slate;
  };

  // Get user bank by unique document ID (preferred for transactions)
  const getUserBankById = (docId) => {
    return userBanks.find(b => b.id === docId || b.firebaseDocId === docId) || null;
  };

  // Get user bank by bank type ID (for backwards compatibility with old transactions)
  // Note: Returns first match only - use getUserBankById for accurate lookups
  const getUserBankByBankId = (bankId) => {
    return userBanks.find(b => b.bankId === bankId) || null;
  };

  /**
   * Smart lookup: finds user bank by either document ID or bank type ID
   * Prioritizes document ID match for accuracy with multiple accounts from same bank
   * Falls back to bank type ID for backwards compatibility
   */
  const findUserBank = (id) => {
    if (!id) return null;
    // First try to find by unique document ID
    const byDocId = userBanks.find(b => b.id === id || b.firebaseDocId === id);
    if (byDocId) return byDocId;
    // Fall back to bank type ID for backwards compatibility
    return userBanks.find(b => b.bankId === id) || null;
  };

  /**
   * Calculate the payment month for a transaction based on bank's credit card dates
   * @param {string} transactionDate - ISO date string of the transaction
   * @param {number} closingDay - Day of month when invoice closes (1-31)
   * @param {number} paymentDay - Day of month when invoice is paid (1-31)
   * @returns {Date} - The month when this transaction will be paid
   */
  const getPaymentMonth = (transactionDate, closingDay, paymentDay) => {
    if (!closingDay || !paymentDay) {
      // For transactions without credit card settings, use transaction date
      return new Date(transactionDate);
    }

    const txDate = new Date(transactionDate);
    const txDay = txDate.getDate();
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    // Determine which invoice this transaction belongs to
    let invoiceMonth, invoiceYear;

    if (txDay < closingDay) {
      // Transaction is before closing day - belongs to current month's invoice
      invoiceMonth = txMonth;
      invoiceYear = txYear;
    } else {
      // Transaction is on or after closing day - goes to next month's invoice
      invoiceMonth = txMonth + 1;
      invoiceYear = txYear;
      if (invoiceMonth > 11) {
        invoiceMonth = 0;
        invoiceYear++;
      }
    }

    // Now determine when this invoice is paid
    let paymentMonth = invoiceMonth;
    let paymentYear = invoiceYear;

    // If payment day is before or equal to closing day, payment is in the same month
    // If payment day is after closing day, payment is in the next month
    if (paymentDay <= closingDay) {
      paymentMonth = invoiceMonth + 1;
      if (paymentMonth > 11) {
        paymentMonth = 0;
        paymentYear++;
      }
    }

    return new Date(paymentYear, paymentMonth, paymentDay);
  };

  /**
   * Get payment month key for grouping (YYYY-MM format)
   * Uses smart lookup to support both old (bankId) and new (document ID) formats
   * @param {string} transactionDate - ISO date string of the transaction
   * @param {string} bankIdOrDocId - Bank document ID or bank type ID
   * @param {string|null|undefined} paymentMethod - 'credit', 'debit', 'pix', 'transfer', or undefined for old data
   */
  const getPaymentMonthKey = (transactionDate, bankIdOrDocId, paymentMethod) => {
    const currentMonthKey = (() => {
      const date = new Date(transactionDate);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    })();

    const userBank = findUserBank(bankIdOrDocId);

    if (!userBank || !userBank.hasCredit || !userBank.closingDay || !userBank.paymentDay) {
      // For cash/debit or banks without credit settings, use transaction date
      return currentMonthKey;
    }

    // Only apply credit card date shifting if paymentMethod is 'credit'
    // Treat undefined/null as 'credit' for backward compatibility with old transactions
    if (paymentMethod && paymentMethod !== 'credit') {
      return currentMonthKey;
    }

    const paymentDate = getPaymentMonth(transactionDate, userBank.closingDay, userBank.paymentDay);
    return `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
  };

  /**
   * Create bills for existing credit cards that don't have bills yet
   * Returns the number of bills created
   */
  const createBillsForExistingCreditCards = async () => {
    try {
      // Get all existing bills to check for linked cards
      const billsSnapshot = await billsResource.list();
      const existingLinkedBankIds = new Set(
        billsSnapshot
          .map((bill) => bill.linkedBankId)
          .filter(id => id)
      );

      // Find credit cards without bills
      const creditCardsWithoutBills = userBanks.filter(
        bank => bank.hasCredit && !existingLinkedBankIds.has(bank.id)
      );

      let createdCount = 0;
      for (const bank of creditCardsWithoutBills) {
        const billId = await createBillForCreditCard({
          bankId: bank.bankId,
          cardName: bank.cardName,
          hasCredit: bank.hasCredit,
          paymentDay: bank.paymentDay
        }, bank.id);

        if (billId) {
          createdCount++;
        }
      }

      return { success: true, created: createdCount };
    } catch (error) {
      console.error('Error creating bills for existing credit cards:', error);
      return { success: false, error: error.message, created: 0 };
    }
  };

  return (
    <CardsContext.Provider value={{
      userBanks,
      loading,
      addBank,
      updateBank,
      deleteBank,
      getBankInfo,
      getBankDisplayName,
      getBankColor,
      getUserBankById,
      getUserBankByBankId,
      findUserBank,
      getPaymentMonth,
      getPaymentMonthKey,
      createBillsForExistingCreditCards,
      banks: BANKS,
      bankColors: BANK_COLORS
    }}>
      {children}
    </CardsContext.Provider>
  );
}

export const useCards = () => {
  const context = useContext(CardsContext);
  if (!context) {
    console.error('useCards must be used within a CardsProvider');
    return {
      userBanks: [],
      loading: false,
      addBank: async () => null,
      updateBank: async () => false,
      deleteBank: async () => false,
      getBankInfo: () => BANKS[BANKS.length - 1],
      getBankDisplayName: () => 'Unknown',
      getBankColor: () => BANK_COLORS.slate,
      getUserBankById: () => null,
      getUserBankByBankId: () => null,
      findUserBank: () => null,
      getPaymentMonth: () => new Date(),
      getPaymentMonthKey: () => '',
      createBillsForExistingCreditCards: async () => ({ success: false, error: 'No context', created: 0 }),
      banks: BANKS,
      bankColors: BANK_COLORS
    };
  }
  return context;
};
