export const GENDERS = [
  { value: "female", label: "Женский" },
  { value: "male", label: "Мужской" },
] as const;

export const AGE_RANGES = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45+", label: "45+" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"];
export type AgeRange = (typeof AGE_RANGES)[number]["value"];

export type Profile = {
  name: string | null;
  gender: Gender | null;
  age_range: AgeRange | null;
};

export function genderLabel(gender: Gender | null): string {
  return GENDERS.find((g) => g.value === gender)?.label ?? "";
}

// Тестовые данные — показываются, пока Supabase не настроен.
export const MOCK_PROFILE: Profile = {
  name: "Анна",
  gender: "female",
  age_range: "25-34",
};
