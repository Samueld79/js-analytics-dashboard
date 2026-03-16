import { getMonthLabel } from '../utils/monthLabel';

type MonthSelectorProps = {
  label: string;
  value: string;
  options: string[];
  helper?: string;
  onChange: (value: string) => void;
};

export function MonthSelector({
  label,
  value,
  options,
  helper,
  onChange,
}: MonthSelectorProps) {
  return (
    <div className="month-selector-wrap">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {getMonthLabel(option)}
          </option>
        ))}
      </select>
      {helper && <p className="source-note">{helper}</p>}
    </div>
  );
}
