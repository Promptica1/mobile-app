"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_EXTRACTION_ATTEMPTS, processPhoto } from "@/lib/garmentExtraction";
import { NO_TOKENS_MESSAGE } from "@/lib/tokens";
import { compressImage } from "@/lib/image";
import { createItem } from "@/lib/items";
import { markPhotoTipsSeen, usePhotoTipsSeen } from "@/lib/photoTips";
import type { NewWardrobeItem } from "@/lib/wardrobe";
import PhotoTips from "./PhotoTips";
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
const FALLBACK_NOTICE = "Не получилось вырезать вещь — сохраним исходное фото. Его можно заменить.";

const toPhoto = (blob: Blob): PickedPhoto => ({ blob, url: URL.createObjectURL(blob) });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AddItemFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  // Исходное (сжатое) фото — запасной вариант, если удалить фон не получится.
  const [original, setOriginal] = useState<PickedPhoto | null>(null);
  // Тип вещи: подсказка для AI и категория в карточке.
  const [category, setCategory] = useState<string | null>(null);
  // Фото, которое сохранится в гардероб: вырезанная вещь или исходное.
  const [result, setResult] = useState<PickedPhoto | null>(null);
  const [phase, setPhase] = useState<ProcessingPhase>("removing");
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [notice, setNotice] = useState("");
  // Уточнение для AI: идёт в задание модели и сохраняется между попытками.
  const [hint, setHint] = useState("");
  // Сколько раз уже запускали AI-вырезание для этой вещи (каждая попытка платная).
  const [attempts, setAttempts] = useState(0);
  const attemptsLeft = MAX_EXTRACTION_ATTEMPTS - attempts;
  // Подсказка о съёмке: сама при первом открытии, потом — по кнопке «?».
  const tipsSeen = usePhotoTipsSeen();
  const [tipsOpen, setTipsOpen] = useState(false);
  const showTips = tipsOpen || !tipsSeen;
  const closeTips = useCallback(() => {
    markPhotoTipsSeen();
    setTipsOpen(false);
  }, []);
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

  // Вырезаем вещь; при неудаче оставляем исходное фото и показываем мягкое сообщение.
  const extractFor = async (photo: PickedPhoto, type: string) => {
    const id = ++runId.current;
    setAttempts((n) => n + 1);
    const processed = await processPhoto(photo.blob, type, hint);
    if (id !== runId.current) return null;
    setResult(processed.extracted ? toPhoto(processed.blob) : photo);
    setNotice(
      processed.extracted
        ? ""
        : processed.noTokens
          ? `${NO_TOKENS_MESSAGE} Сохраним исходное фото.`
          : FALLBACK_NOTICE,
    );
    return processed.extracted;
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
      // На шаге 3 «Загрузить другое фото»: сразу вырезаем вещь и с нового снимка.
      if (step === 3 && category && attemptsLeft > 0) await extractFor(photo, category);
    }
    setPreparing(false);
  };

  const picker = usePhotoPicker(handlePick);

  // «Повторить с уточнением»: то же фото, новое задание для AI (1 попытка и 1 токен).
  const handleRegenerate = async () => {
    if (!original || !category || attemptsLeft <= 0) return;
    setPreparing(true);
    setPhotoError("");
    await extractFor(original, category);
    setPreparing(false);
  };

  const startProcessing = async () => {
    if (!original || !category) return;
    // Попытки закончились — без AI переходим к проверке с исходным фото.
    if (attemptsLeft <= 0) {
      setResult(original);
      setNotice("");
      setStep(3);
      return;
    }
    setStep(2);
    setPhase("removing");
    const extracted = await extractFor(original, category);
    if (extracted === null) return;
    setPhase(extracted ? "done" : "fallback");
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
      {showTips && <PhotoTips onClose={closeTips} />}
      <StepHeader
        {...headers[step]}
        onBack={handleBack}
        onHelp={step === 1 ? () => setTipsOpen(true) : undefined}
      />
      {step === 1 && (
        <StepPhoto
          photoUrl={original?.url ?? null}
          category={category}
          onCategory={setCategory}
          hint={hint}
          onHintChange={setHint}
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
          category={category ?? ""}
          onCategoryChange={setCategory}
          retriesLeft={attemptsLeft}
          onRetake={picker.openGallery}
          hint={hint}
          onHintChange={setHint}
          onRegenerate={handleRegenerate}
          onSubmit={handleSave}
        />
      )}
    </>
  );
}
