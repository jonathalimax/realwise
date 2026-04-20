import { NumericFormat } from 'react-number-format';
import { useSettings } from '../../contexts/SettingsContext';

const CURRENCY_FORMATS = {
  BRL: { thousandSeparator: '.', decimalSeparator: ',', prefix: 'R$ ', placeholder: 'R$ 1.000,00' },
  USD: { thousandSeparator: ',', decimalSeparator: '.', prefix: '$ ', placeholder: '$ 1,000.00' },
  EUR: { thousandSeparator: '.', decimalSeparator: ',', prefix: '€ ', placeholder: '€ 1.000,00' },
  GBP: { thousandSeparator: ',', decimalSeparator: '.', prefix: '£ ', placeholder: '£ 1,000.00' },
};

export default function CurrencyInput({ value, onChange, className = '', ...props }) {
  const { currency } = useSettings();
  const format = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS.BRL;

  // Don't show 0 as initial value - show empty or the actual value
  const displayValue = value === 0 || value === undefined || value === null ? '' : value;

  return (
    <NumericFormat
      value={displayValue}
      onValueChange={(values) => {
        // Pass the float value or 0 if empty
        onChange(values.floatValue ?? 0);
      }}
      thousandSeparator={format.thousandSeparator}
      decimalSeparator={format.decimalSeparator}
      prefix={format.prefix}
      decimalScale={2}
      fixedDecimalScale={true}
      allowNegative={false}
      allowLeadingZeros={false}
      placeholder={format.placeholder}
      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-lg
        text-gray-900 dark:text-white placeholder-gray-400
        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
        transition-all duration-200 ${className}`}
      {...props}
    />
  );
}
