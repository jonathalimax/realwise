export function serializeBillPayload({ formData, postponeCount = 0 }) {
  return {
    name: formData.name.trim(),
    description: formData.description.trim(),
    dueDate: new Date(formData.dueDate).toISOString(),
    category: formData.category,
    amount: formData.amount ? Number(formData.amount).toFixed(2) : '0.00',
    recurrence: formData.recurrence,
    recurrenceEndDate: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
    notificationEnabled: formData.notificationEnabled,
    notificationDaysBefore: parseInt(formData.notificationDaysBefore, 10),
    postponeCount,
  };
}
