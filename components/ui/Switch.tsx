// Переключатель вкл/выкл в стиле приложения.
export default function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-lime" : "bg-border"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-surface shadow-[0_1px_3px_rgba(44,44,42,0.25)] transition-transform ${
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
