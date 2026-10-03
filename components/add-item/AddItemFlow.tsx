"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { processPhoto } from "@/lib/backgroundRemoval";
import { compressImage } from "@/lib/image";
import { createItem } from "@/lib/items";
import type { NewWardrobeItem } from "@/lib/wardrobe";
import StepHeader from "./StepHeader";
import StepPhoto from "./StepPhoto";
import StepProcessing, { type ProcessingPhase } from "./StepProcessing";
import StepReview from "./StepReview";
import { usePhotoPicker } from "./usePhotoPicker";

type Step = 1 | 2 | 3;
type PickedPhoto = { blob: Blob; url: string };

const headers: Record<Step, { title: string; subtitle: string }> = {
  1: { title: "Добавить вещь", subtitle: "Шаг 1 из 3 — фото" },
  2: { title: "Обработка", subtitle: "Шаг 2 из 3 — AI работает" },
  3: { title: "Проверьте вещь", subtitle: "Шаг 3 из 3 — можно всё поправить" },
};

// Короткая пауза, чтобы пользователь успел увидеть результат на шаге «Обработка».
const SHOW_RESULT_MS = 900;
const FALLBACK_NOTICE = "Не получилось убрать фон — сохраним исходное фото. Его можно заменить.";

const toPhoto = (blob: Blob): PickedPhoto => ({ blob, url: URL.createObjectURL(blob) });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AddItemFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  // Исходное (сжатое) фото — запасной вариант, если удалить фон не получится.
  const [original, setOriginal] = useState<PickedPhoto | null>(null);
  // Фото, которое сохранится в гардероб: вырезанная вещь или исходное.
  const [result, setResult] = useState<PickedPhoto | null>(null);
  const [phase, setPhase] = useState<ProcessingPhase>("removing");
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [notice, setNotice] = useState("");
  // Номер текущей обработки: ответ от устаревшей (пользователь ушёл назад) игнорируем.
  const runId = useRef(0);

  // Освобождаем память превью, когда фото заменили или ушли со страницы.
  useEffect(() => {
    if (!original) return;
    return () => URL.revokeObjectURL(original.url);
  }, [original]);
  useEffect(() => {
    if (!result || result.blob === original?.blob) return;
    return () => URL.revokeObjectURL(result.url);
  }, [result, original]);

  // Удаляем фон; при неудаче оставляем исходное фото и показываем мягкое сообщение.
  const removeBackgroundFor = async (photo: PickedPhoto) => {
    const id = ++runId.current;
    const processed = await processPhoto(photo.blob);
    if (id !== runId.current) return null;
    setResult(processed.cutout ? toPhoto(processed.blob) : photo);
    setNotice(processed.cutout ? "" : FALLBACK_NOTICE);
    return processed.cutout;
  };

  const preparePicked = async (file: File): Promise<PickedPhoto | null> => {
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Это не похоже на фото. Выберите картинку.");
      return null;
    }
    try {
      return toPhoto(await compressImage(file));
    } catch {
      setPhotoError("Не получилось открыть это фото. Попробуйте другое.");
      return null;
    }
  };

  const handlePick = async (file: File) => {
    setPreparing(true);
    const photo = await preparePicked(file);
    if (photo) {
      setOriginal(photo);
      setResult(null);
      // На шаге 3 «Загрузить другое фото»: сразу убираем фон и у нового снимка.
      if (step === 3) await removeBackgroundFor(photo);
    }
    setPreparing(false);
  };

  const picker = usePhotoPicker(handlePick);

  const startProcessing = async () => {
    if (!original) return;
    setStep(2);
    setPhase("removing");
    const cutout = await removeBackgroundFor(original);
    if (cutout === null) return;
    setPhase(cutout ? "done" : "fallback");
    await wait(SHOW_RESULT_MS);
    setStep((current) => (current === 2 ? 3 : current));
  };

  const goToWardrobe = () => router.push("/wardrobe");
  const handleBack = () => {
    if (step === 1) return goToWardrobe();
    runId.current++; // отменяем незавершённую обработку
    setResult(null);
    setNotice("");
    setStep(1);
  };

  // Загружаем фото в Storage, сохраняем вещь и возвращаемся в гардероб.
  const handleSave = async (item: NewWardrobeItem) => {
    await createItem(item, (result ?? original)?.blob ?? null);
    router.push("/wardrobe");
    router.refresh();
  };

  const shown = result ?? original;

  return (
    <>
      {picker.inputs}
      <StepHeader {...headers[step]} onBack={handleBack} />
      {step === 1 && (
        <StepPhoto
          photoUrl={original?.url ?? null}
          preparing={preparing}
          error={photoError}
          onCamera={picker.openCamera}
          onGallery={picker.openGallery}
          onNext={startProcessing}
        />
      )}
      {step === 2 && <StepProcessing photoUrl={shown?.url ?? null} phase={phase} />}
      {step === 3 && (
        <StepReview
          photoUrl={shown?.url ?? null}
          preparing={preparing}
          photoError={photoError}
          notice={notice}
          onRetake={picker.openGallery}
          onSubmit={handleSave}
        />
      )}
    </>
  );
}
