import type { Metadata } from "next";
import { EyeOff, Lock, Sparkles } from "lucide-react";
import DeleteAccount from "@/components/profile/DeleteAccount";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Приватность и данные — Digital Wardrobe" };

const POINTS = [
  {
    Icon: Sparkles,
    title: "Фото — только для аватара и образов",
    text: "Селфи и фото вещей нужны, чтобы AI создал ваш аватар, вырезал вещи и примерил на вас образы.",
  },
  {
    Icon: Lock,
    title: "Хранятся закрыто",
    text: "Вещи, аватар, образы и фото профиля лежат в закрытом хранилище и открываются только по временной ссылке.",
  },
  {
    Icon: EyeOff,
    title: "Видите только вы",
    text: "Ваши данные не видят другие пользователи. Исходные селфи для аватара не сохраняются.",
  },
];

export default function PrivacyPage() {
  return (
    <SubScreen title="Приватность">
      <ul className="flex flex-col gap-3">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-3.5 rounded-card border border-border bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender/20">
              <Icon size={18} strokeWidth={1.5} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">{title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-auto pt-10">
        <h2 className="px-1 text-sm font-medium">Удаление аккаунта</h2>
        <p className="mb-4 mt-1 px-1 text-sm leading-relaxed text-muted">
          Удалит аккаунт и все ваши данные и файлы без возможности восстановления.
        </p>
        <DeleteAccount />
      </section>
    </SubScreen>
  );
}
