// src/components/ui/PercentInput.jsx
import { NumericFormat } from 'react-number-format';

export default function PercentInput({ value, onChange, className = '', decimalScale = 1, placeholder = '0 %', ...props }) {
  return (
    <NumericFormat
      value={value === 0 || value === undefined || value === null ? '' : value}
      onValueChange={(vals) => onChange(vals.floatValue ?? 0)}
      suffix=" %"
      decimalSeparator=","
      decimalScale={decimalScale}
      allowNegative={false}
      placeholder={placeholder}
      className={`px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
        text-gray-900 dark:text-white placeholder-gray-400
        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
        transition-all duration-200 ${className || 'w-full'}`}
      {...props}
    />
  );
}
