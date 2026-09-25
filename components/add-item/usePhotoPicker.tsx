import { useRef, type ChangeEvent } from "react";

// Два скрытых поля выбора файла: камера (на телефоне сразу открывает съёмку)
// и галерея. На компьютере оба открывают обычный выбор файла.
export function usePhotoPicker(onPick: (file: File) => void) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем значение, чтобы можно было выбрать тот же файл повторно.
    e.target.value = "";
    if (file) onPick(file);
  };

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
        data-testid="camera-input"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
        data-testid="gallery-input"
      />
    </>
  );

  return {
    openCamera: () => cameraRef.current?.click(),
    openGallery: () => galleryRef.current?.click(),
    inputs,
  };
}
