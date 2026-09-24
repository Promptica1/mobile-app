"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "./StepHeader";
import StepPhoto from "./StepPhoto";
import StepProcessing from "./StepProcessing";
import StepReview from "./StepReview";

type Step = 1 | 2 | 3;

const headers: Record<Step, { title: string; subtitle: string }> = {
  1: { title: "Добавить вещь", subtitle: "Шаг 1 из 3 — фото" },
  2: { title: "Обработка", subtitle: "Шаг 2 из 3 — AI работает" },
  3: { title: "Проверьте вещь", subtitle: "Шаг 3 из 3 — можно всё поправить" },
};

export default function AddItemFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const goToWardrobe = () => router.push("/wardrobe");
  // Шаг 2 обрабатывается автоматически, поэтому «назад» с шагов 2 и 3 ведёт на шаг 1.
  const handleBack = () => (step === 1 ? goToWardrobe() : setStep(1));
  const handleProcessed = useCallback(() => setStep(3), []);

  return (
    <>
      <StepHeader {...headers[step]} onBack={handleBack} />
      {step === 1 && <StepPhoto onNext={() => setStep(2)} />}
      {step === 2 && <StepProcessing onDone={handleProcessed} />}
      {step === 3 && (
        <StepReview onRetake={() => setStep(1)} onSubmit={goToWardrobe} />
      )}
    </>
  );
}
