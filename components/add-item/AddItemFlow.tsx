"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/image";
import { createItem } from "@/lib/items";
import type { NewWardrobeItem } from "@/lib/wardrobe";
import StepHeader from "./StepHeader";
import StepPhoto from "./StepPhoto";
import StepProcessing from "./StepProcessing";
import StepReview from "./StepReview";
import { usePhotoPicker } from "./usePhotoPicker";

type Step = 1 | 2 | 3;
type PickedPhoto = { blob: Blob; url: string };

const headers: Record<Step, { title: string; subtitle: string }> = {
  1: { title: "Добавить вещь", subtitle: "Шаг 1 из 3 — фото" },
  2: { title: "Обработка", subtitle: "Шаг 2 из 3 — AI работает" },
  3: { title: "Проверьте вещь", subtitle: "Шаг 3 из 3 — можно всё поправить" },
};

export default function AddItemFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Освобождаем память старого превью, когда фото заменили или ушли со страницы.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const handlePick = async (file: File) => {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Это не похоже на фото. Выберите картинку.");
      return;
    }
    setPreparing(true);
    try {
      const blob = await compressImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoError("Не получилось открыть это фото. Попробуйте другое.");
    } finally {
      setPreparing(false);
    }
  };

  const picker = usePhotoPicker(handlePick);

  const goToWardrobe = () => router.push("/wardrobe");
  // Шаг 2 обрабатывается автоматически, поэтому «назад» с шагов 2 и 3 ведёт на шаг 1.
  const handleBack = () => (step === 1 ? goToWardrobe() : setStep(1));
  const handleProcessed = useCallback(() => setStep(3), []);

  // Загружаем фото в Storage, сохраняем вещь и возвращаемся в гардероб.
  const handleSave = async (item: NewWardrobeItem) => {
    await createItem(item, photo?.blob ?? null);
    router.push("/wardrobe");
    router.refresh();
  };

  return (
    <>
      {picker.inputs}
      <StepHeader {...headers[step]} onBack={handleBack} />
      {step === 1 && (
        <StepPhoto
          photoUrl={photo?.url ?? null}
          preparing={preparing}
          error={photoError}
          onCamera={picker.openCamera}
          onGallery={picker.openGallery}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && <StepProcessing photoUrl={photo?.url ?? null} onDone={handleProcessed} />}
      {step === 3 && (
        <StepReview
          photoUrl={photo?.url ?? null}
          preparing={preparing}
          photoError={photoError}
          onRetake={picker.openGallery}
          onSubmit={handleSave}
        />
      )}
    </>
  );
}
