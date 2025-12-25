import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';

const CardsContext = createContext();

// Predefined card icons
export const CARD_ICONS = {
  credit: '💳',
  debit: '🏦',
  nubank: '💜',
  itau: '🧡',
  bradesco: '❤️',
  santander: '❤️',
  caixa: '💙',
  bb: '💛',
  inter: '🧡',
  c6: '⬛',
  other: '💰'
};

// Predefined card colors
export const CARD_COLORS = [
  { name: 'slate', bg: 'bg-slate-700', light: 'bg-slate-100', text: 'text-slate-700' },
  { name: 'purple', bg: 'bg-purple-600', light: 'bg-purple-100', text: 'text-purple-600' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-600' },
  { name: 'blue', bg: 'bg-blue-600', light: 'bg-blue-100', text: 'text-blue-600' },
  { name: 'emerald', bg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-600' },
  { name: 'rose', bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-600' },
  { name: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600' },
  { name: 'cyan', bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-600' },
  { name: 'indigo', bg: 'bg-indigo-600', light: 'bg-indigo-100', text: 'text-indigo-600' },
];

export function CardsProvider({ children }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Listen for cards when userId is available
  useEffect(() => {
    if (!userId) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'cards'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cardsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by createdAt
        cardsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateA - dateB; // Oldest first
        });
        setCards(cardsData);
        setLoading(false);
      },
      (err) => {
        console.error('Cards query error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const addCard = async (cardData) => {
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return null;
    }

    try {
      const newCard = {
        userId: auth.currentUser.uid,
        name: cardData.name,
        type: cardData.type || 'credit', // 'credit' or 'debit'
        lastDigits: cardData.lastDigits || '',
        icon: cardData.icon || (cardData.type === 'debit' ? 'debit' : 'credit'),
        color: cardData.color || 'slate',
        closingDay: cardData.type === 'credit' ? (cardData.closingDay || null) : null,
        paymentDay: cardData.type === 'credit' ? (cardData.paymentDay || null) : null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'cards'), newCard);
      return docRef.id;
    } catch (error) {
      console.error('Error adding card:', error);
      return null;
    }
  };

  const updateCard = async (cardId, updates) => {
    try {
      const cardRef = doc(db, 'cards', cardId);
      await updateDoc(cardRef, updates);
      return true;
    } catch (error) {
      console.error('Error updating card:', error);
      return false;
    }
  };

  const deleteCard = async (cardId) => {
    try {
      await deleteDoc(doc(db, 'cards', cardId));
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      return false;
    }
  };

  const getCardColor = (colorName) => {
    return CARD_COLORS.find(c => c.name === colorName) || CARD_COLORS[0]; // default slate
  };

  const getCardById = (cardId) => {
    return cards.find(c => c.id === cardId) || null;
  };

  /**
   * Calculate the payment month for a transaction based on card closing/payment dates
   * @param {string} transactionDate - ISO date string of the transaction
   * @param {number} closingDay - Day of month when invoice closes (1-31)
   * @param {number} paymentDay - Day of month when invoice is paid (1-31)
   * @returns {Date} - The month when this transaction will be paid
   */
  const getPaymentMonth = (transactionDate, closingDay, paymentDay) => {
    if (!closingDay || !paymentDay) {
      // For debit cards or cards without closing dates, use transaction date
      return new Date(transactionDate);
    }

    const txDate = new Date(transactionDate);
    const txDay = txDate.getDate();
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    // Determine which invoice this transaction belongs to
    let invoiceMonth, invoiceYear;

    if (txDay <= closingDay) {
      // Transaction is before or on closing day - belongs to current month's invoice
      invoiceMonth = txMonth;
      invoiceYear = txYear;
    } else {
      // Transaction is after closing day - goes to next month's invoice
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
   */
  const getPaymentMonthKey = (transactionDate, card) => {
    if (!card || card.type !== 'credit' || !card.closingDay || !card.paymentDay) {
      // For cash/debit, use transaction date
      const date = new Date(transactionDate);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const paymentDate = getPaymentMonth(transactionDate, card.closingDay, card.paymentDay);
    return `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <CardsContext.Provider value={{
      cards,
      loading,
      addCard,
      updateCard,
      deleteCard,
      getCardColor,
      getCardById,
      getPaymentMonth,
      getPaymentMonthKey,
      cardIcons: CARD_ICONS,
      cardColors: CARD_COLORS
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
      cards: [],
      loading: false,
      addCard: async () => null,
      updateCard: async () => false,
      deleteCard: async () => false,
      getCardColor: () => CARD_COLORS[0],
      getCardById: () => null,
      getPaymentMonth: () => new Date(),
      getPaymentMonthKey: () => '',
      cardIcons: CARD_ICONS,
      cardColors: CARD_COLORS
    };
  }
  return context;
};
