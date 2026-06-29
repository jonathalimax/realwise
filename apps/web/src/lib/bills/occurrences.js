function parseSelectedMonth(selectedMonth) {
  if (selectedMonth) {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return { year, month };
    }
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function normalizeDateOnly(value) {
  if (!value) return null;
  return value.slice(0, 10);
}

function buildLegacySeriesFingerprint(bill) {
  return [
    bill.userId ?? '',
    bill.clientId ?? '',
    bill.name ?? '',
    bill.amount ?? '',
    bill.categoryId ?? '',
    bill.category ?? '',
    bill.description ?? '',
    bill.recurrence ?? '',
    normalizeDateOnly(bill.recurrenceEndDate) ?? '',
    bill.linkedBankId ?? '',
  ].join('|');
}

export function getBillSeriesKey(bill) {
  if (bill.seriesId) {
    return `series:${bill.seriesId}`;
  }

  if (!bill.recurrence || bill.recurrence === 'none') {
    return `bill:${bill.id}`;
  }

  return `legacy:${buildLegacySeriesFingerprint(bill)}`;
}

function getBillSeriesAliases(bill) {
  const aliases = [getBillSeriesKey(bill)];

  if (bill.recurrence && bill.recurrence !== 'none') {
    aliases.push(`legacy:${buildLegacySeriesFingerprint(bill)}`);
  }

  return [...new Set(aliases)];
}

function isRecurringBill(bill) {
  return Boolean(bill.recurrence && bill.recurrence !== 'none');
}

function isSameSelectedMonth(dateString, selectedYear, selectedMonth) {
  const dueDate = new Date(dateString);
  return dueDate.getUTCFullYear() === selectedYear && (dueDate.getUTCMonth() + 1) === selectedMonth;
}

function calculatePreviewDueDate(sourceBill, selectedYear, selectedMonth) {
  const originalDueDate = new Date(sourceBill.dueDate);
  const day = originalDueDate.getUTCDate();

  if (sourceBill.recurrence === 'monthly') {
    const lastDayOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
    const adjustedDay = Math.min(day, lastDayOfMonth);
    return new Date(Date.UTC(selectedYear, selectedMonth - 1, adjustedDay)).toISOString();
  }

  if (sourceBill.recurrence === 'yearly') {
    const lastDayOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
    const adjustedDay = Math.min(day, lastDayOfMonth);
    return new Date(Date.UTC(selectedYear, selectedMonth - 1, adjustedDay)).toISOString();
  }

  return null;
}

function shouldPreviewRecurringBillInMonth(bill, selectedYear, selectedMonth) {
  const originalDueDate = new Date(bill.dueDate);
  const originalYear = originalDueDate.getUTCFullYear();
  const originalMonth = originalDueDate.getUTCMonth() + 1;

  if (bill.recurrenceEndDate) {
    const endDate = new Date(bill.recurrenceEndDate);
    const selectedDateUTC = Date.UTC(selectedYear, selectedMonth - 1, 1);
    if (selectedDateUTC > endDate.getTime()) {
      return false;
    }
  }

  if (bill.recurrence === 'monthly') {
    return Date.UTC(selectedYear, selectedMonth - 1, 1) >= Date.UTC(originalYear, originalMonth - 1, 1);
  }

  if (bill.recurrence === 'yearly') {
    return originalMonth === selectedMonth && selectedYear >= originalYear;
  }

  return false;
}

export function buildMonthlyBillRows(bills, selectedMonth) {
  const { year: selectedYear, month: selectedMonthNum } = parseSelectedMonth(selectedMonth);
  const concreteOccurrenceKeys = new Set();
  const previewCandidates = [];
  const rows = [];

  for (const bill of bills) {
    if (!isRecurringBill(bill)) {
      rows.push(bill);
      continue;
    }

    const seriesKey = getBillSeriesKey(bill);
    const occurrenceKey = `${seriesKey}::${normalizeDateOnly(bill.dueDate)}`;

    if (isSameSelectedMonth(bill.dueDate, selectedYear, selectedMonthNum)) {
      rows.push({
        ...bill,
        seriesId: bill.seriesId ?? null,
        occurrenceKey,
        isRecurringInstance: false,
        isPreviewOccurrence: false,
      });
      for (const key of getBillSeriesAliases(bill)) {
        concreteOccurrenceKeys.add(`${key}::${normalizeDateOnly(bill.dueDate)}`);
      }
      continue;
    }

    previewCandidates.push({ bill, seriesKey });
  }

  for (const { bill, seriesKey } of previewCandidates) {
    if (!shouldPreviewRecurringBillInMonth(bill, selectedYear, selectedMonthNum)) {
      continue;
    }

    const previewDueDate = calculatePreviewDueDate(bill, selectedYear, selectedMonthNum);
    if (!previewDueDate) continue;

    const occurrenceKey = `${seriesKey}::${normalizeDateOnly(previewDueDate)}`;
    const aliases = getBillSeriesAliases(bill).map((key) => `${key}::${normalizeDateOnly(previewDueDate)}`);
    if (aliases.some((key) => concreteOccurrenceKeys.has(key))) {
      continue;
    }

    rows.push({
      ...bill,
      dueDate: previewDueDate,
      originalDueDate: bill.dueDate,
      seriesId: bill.seriesId ?? null,
      occurrenceKey,
      isRecurringInstance: true,
      isPreviewOccurrence: true,
      status: bill.status === 'paid' ? 'pending' : bill.status,
    });
  }

  return rows;
}
