import { NAME_MAX } from "@/lib/looks";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function TextField({ label, value, onChange, placeholder, autoFocus }: Props) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium">{label}</span>
      <input
        type="text"
        value={value}
        maxLength={NAME_MAX}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-2xl border border-border bg-subtle px-4 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
      />
    </label>
  );
}
