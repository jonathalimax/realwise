import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function BalanceSummary() {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0
  });

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let income = 0;
      let expenses = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'income') {
          income += data.amount;
        } else {
          expenses += data.amount;
        }
      });

      setSummary({
        totalIncome: income,
        totalExpenses: expenses,
        balance: income - expenses
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium">Total Income</p>
            <p className="text-3xl font-bold mt-1">${summary.totalIncome.toFixed(2)}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm font-medium">Total Expenses</p>
            <p className="text-3xl font-bold mt-1">${summary.totalExpenses.toFixed(2)}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl shadow-lg p-6 text-white ${
          summary.balance >= 0
            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
            : 'bg-gradient-to-br from-orange-500 to-orange-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Current Balance</p>
            <p className="text-3xl font-bold mt-1">${summary.balance.toFixed(2)}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
