import { redirect } from "next/navigation";

// Старый адрес политики — теперь она на /legal/privacy.
export default function PolicyPage() {
  redirect("/legal/privacy");
}
