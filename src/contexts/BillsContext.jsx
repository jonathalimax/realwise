import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAccess } from './AccessContext';

const BillsContext = createContext();

export const useBills = () => {
  const context = useContext(BillsContext);
  if (!context) {
    throw new Error('useBills must be used within a BillsProvider');
  }
  return context;
};

export const BillsProvider = ({ children }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  // Load bills from Firestore
  useEffect(() => {
    if (!ownerId) {
      setBills([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bills'),
      where('userId', '==', ownerId) // Use ownerId instead of user.uid
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setBills(billsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]); // Use ownerId

  // Add a new bill
  const addBill = async (billData) => {
    try {
      const newBill = {
        ...billData,
        userId: auth.currentUser.uid,
        status: 'pending', // pending, paid, overdue
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'bills'), newBill);
      return { success: true };
    } catch (error) {
      console.error('Error adding bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Update a bill
  const updateBill = async (billId, updates) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Delete a bill
  const deleteBill = async (billId) => {
    try {
      await deleteDoc(doc(db, 'bills', billId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Mark bill as paid
  const markBillAsPaid = async (billId, paidDate = new Date().toISOString()) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        status: 'paid',
        paidDate: paidDate,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      return { success: false, error: error.message };
    }
  };

  // Postpone bill reminder
  const postponeBillReminder = async (billId, postponeHours = 2) => {
    try {
      const newReminderTime = new Date();
      newReminderTime.setHours(newReminderTime.getHours() + postponeHours);

      // Create postponement record
      await addDoc(collection(db, 'bill_reminders'), {
        billId,
        userId: auth.currentUser.uid,
        postponedFrom: new Date().toISOString(),
        postponedTo: newReminderTime.toISOString(),
        createdAt: serverTimestamp()
      });

      // Update bill with new reminder time
      await updateDoc(doc(db, 'bills', billId), {
        nextReminderAt: newReminderTime.toISOString(),
        postponeCount: (bills.find(b => b.id === billId)?.postponeCount || 0) + 1,
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error postponing bill reminder:', error);
      return { success: false, error: error.message };
    }
  };

  // Get bills by status
  const getBillsByStatus = (status) => {
    return bills.filter(bill => bill.status === status);
  };

  // Get upcoming bills (due within next 7 days)
  const getUpcomingBills = () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return bills
      .filter(bill => {
        if (bill.status === 'paid') return false;
        const dueDate = new Date(bill.dueDate);
        return dueDate >= now && dueDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // Sort by dueDate ascending
  };

  // Get overdue bills
  const getOverdueBills = () => {
    const now = new Date();
    return bills
      .filter(bill => {
        if (bill.status === 'paid') return false;
        const dueDate = new Date(bill.dueDate);
        return dueDate < now;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // Sort by dueDate ascending
  };

  // Calculate next occurrence for recurring bills
  const calculateNextDueDate = (currentDueDate, recurrenceType) => {
    const date = new Date(currentDueDate);

    switch (recurrenceType) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }

    return date.toISOString();
  };

  const value = {
    bills,
    loading,
    addBill,
    updateBill,
    deleteBill,
    markBillAsPaid,
    postponeBillReminder,
    getBillsByStatus,
    getUpcomingBills,
    getOverdueBills,
    calculateNextDueDate
  };

  return (
    <BillsContext.Provider value={value}>
      {children}
    </BillsContext.Provider>
  );
};
