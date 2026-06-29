import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccess } from './AccessContext';
import { requireOwnerId } from '../lib/auth/ownerSession';
import { billsResource, subscribeBillsChanged } from '../lib/api/resources/bills';

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

  const loadBills = useCallback(async () => {
    if (!ownerId) {
      setBills([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await billsResource.list();
      setBills(rows);
    } catch (error) {
      console.error('Error loading bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadBills();
    return subscribeBillsChanged(() => {
      loadBills();
    });
  }, [loadBills]);

  // Add a new bill
  const addBill = async (billData) => {
    try {
      const newBill = {
        ...billData,
        status: 'pending', // pending, paid, overdue
        recurrence: billData.recurrence === 'none' ? null : billData.recurrence,
      };
      await billsResource.create(newBill);
      await loadBills();
      return { success: true };
    } catch (error) {
      console.error('Error adding bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Update a bill
  const updateBill = async (billId, updates) => {
    try {
      await billsResource.update(billId, {
        ...updates,
        recurrence: updates.recurrence === 'none' ? null : updates.recurrence,
      });
      await loadBills();
      return { success: true };
    } catch (error) {
      console.error('Error updating bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Delete a bill
  const deleteBill = async (billId) => {
    try {
      await billsResource.remove(billId);
      await loadBills();
      return { success: true };
    } catch (error) {
      console.error('Error deleting bill:', error);
      return { success: false, error: error.message };
    }
  };

  // Mark bill as paid
  const markBillAsPaid = async (payloadOrBillId, paidAt = new Date().toISOString(), targetDueDate = null, paidAmount = null) => {
    try {
      const payload = typeof payloadOrBillId === 'object' && payloadOrBillId !== null
        ? payloadOrBillId
        : {
            billId: payloadOrBillId,
            paidAt,
            targetDueDate,
            paidAmount,
          };

      await billsResource.markPaid(payload.billId, {
        paidAt: payload.paidAt ?? new Date().toISOString(),
        paidAmount: payload.paidAmount ?? null,
        targetDueDate: payload.targetDueDate ?? null,
        virtualDueDate: payload.virtualDueDate ?? null,
      });
      await loadBills();
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

      await billsResource.update(billId, {
        nextReminderAt: newReminderTime.toISOString(),
        postponeCount: (bills.find(b => b.id === billId)?.postponeCount || 0) + 1,
      });
      await loadBills();
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
