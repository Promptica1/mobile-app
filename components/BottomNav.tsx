"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Sparkles, User } from "lucide-react";
import HangerIcon from "./HangerIcon";

const tabs = [
  { href: "/wardrobe", label: "Гардероб", Icon: HangerIcon },
  { href: "/try-on", label: "Примерка", Icon: Shirt },
  { href: "/looks", label: "Образы", Icon: Sparkles },
  { href: "/profile", label: "Профиль", Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="flex h-[4.5rem] items-stretch justify-around px-2">
        {tabs.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/wardrobe" && pathname === "/");

          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-text" : "text-muted hover:text-text/70"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-lavender/35" : ""
                  }`}
                >
                  <Icon size={22} strokeWidth={1.5} />
                </span>
                <span className="text-[11px] font-medium tracking-wide">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
