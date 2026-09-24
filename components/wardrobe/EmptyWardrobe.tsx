export default function EmptyWardrobe() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      {/* Пунктирный силуэт человека */}
      <svg
        width="96"
        height="152"
        viewBox="0 0 96 152"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        strokeLinecap="round"
        className="text-muted"
        aria-hidden="true"
      >
        <circle cx="48" cy="20" r="14" />
        <path d="M48 40c-14 0-24 8-26 20l-6 36a4 4 0 0 0 8 1l6-30v79a5 5 0 0 0 10 0v-44h16v44a5 5 0 0 0 10 0V67l6 30a4 4 0 0 0 8-1l-6-36c-2-12-12-20-26-20Z" />
      </svg>

      <h2 className="mt-8 font-serif text-3xl font-medium">Ваш гардероб пуст</h2>
      <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-muted">
        Добавьте первую вещь — сфотографируйте или загрузите фото
      </p>
      <button
        type="button"
        className="mt-8 rounded-full bg-lime px-8 py-3.5 text-sm font-medium text-text transition-transform active:scale-[0.98]"
      >
        Добавить вещь
      </button>
    </div>
  );
}
