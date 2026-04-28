import { useSettings } from '../../contexts/SettingsContext';

export default function CategoryPicker({ isOpen, onClose, onSelect, currentCategory, type }) {
  const { categories } = useSettings();

  if (!isOpen) return null;

  const categoryList = [...(categories[type] || [])].sort((a, b) => a.localeCompare(b));

  const handleChange = (e) => {
    onSelect(e.target.value);
    onClose();
  };

  return (
    <select
      value={currentCategory || ''}
      onChange={handleChange}
      autoFocus
      className="appearance-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-violet-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">Select category...</option>
      {categoryList.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}
