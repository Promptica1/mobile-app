import { Eraser, RefreshCw } from "lucide-react";

type Props = {
  hasAvatar: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onAvatar: () => void;
};

export default function ActionsMenu({ hasAvatar, onClose, onClearAll, onAvatar }: Props) {
  const actions = [
    { label: "Очистить всё", Icon: Eraser, onClick: onClearAll },
    { label: hasAvatar ? "Обновить аватар" : "Создать аватар", Icon: RefreshCw, onClick: onAvatar },
  ];

  return (
    <>
      {/* Прозрачная подложка: нажатие вне меню закрывает его */}
      <button
        type="button"
        aria-label="Закрыть меню"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default"
      />
      <div
        role="menu"
        className="absolute right-0 top-14 z-40 w-56 overflow-hidden rounded-2xl border border-border bg-surface py-1.5 shadow-[0_12px_32px_-12px_rgba(44,44,42,0.25)]"
      >
        {actions.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            onClick={() => {
              onClick();
              onClose();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors hover:bg-background"
          >
            <Icon size={18} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
