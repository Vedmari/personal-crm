import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import { Cover, DIARY_SHEET_X, DiarySheet, Logo } from "@/components/paper";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Вход — Личная CRM" };

// The sign-in: a sheet of the notebook like the other pages. Without a
// sign-in every page leads here (src/proxy.ts).
export default function LoginPage() {
  return (
    <Cover>
      <main>
        <DiarySheet>
          <div className={cn(DIARY_SHEET_X, "pt-42 pb-56 md:pb-70")}>
            <Logo />
            <h1 className="relative -top-7 mt-row font-serif text-h2 font-medium text-ink md:-top-9 md:text-h2-md">
              Вход
            </h1>
            <p className="max-w-640 font-sans text-body text-pretty text-ink-body md:text-body-md">
              Введите почту — пришлём ссылку для входа. Пароль не нужен.
            </p>
            <div className="mt-row">
              <LoginForm />
            </div>
          </div>
        </DiarySheet>
      </main>
    </Cover>
  );
}
