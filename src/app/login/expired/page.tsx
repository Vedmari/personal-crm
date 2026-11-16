import type { Metadata } from "next";
import Link from "next/link";

import { Cover, DIARY_SHEET_X, DiarySheet, Logo } from "@/components/paper";
import { ButtonDot, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ссылка устарела — Личная CRM" };

// Where a sign-in link that does not work any more leads: used, older than
// 15 minutes, cancelled by a newer one or unknown. Better Auth does not tell
// these apart, and the advice is the same for all of them.
export default function LoginLinkExpiredPage() {
  return (
    <Cover>
      <main>
        <DiarySheet>
          <div className={cn(DIARY_SHEET_X, "pt-42 pb-56 md:pb-70")}>
            <Logo />
            <h1 className="relative -top-7 mt-row font-serif text-h2 font-medium text-ink md:-top-9 md:text-h2-md">
              Ссылка устарела, запросите новую
            </h1>
            <p className="max-w-640 font-sans text-body text-pretty text-ink-body md:text-body-md">
              Ссылка из письма работает один раз и 15 минут. Новая ссылка
              отменяет прежние.
            </p>
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", className: "mt-row" })}
            >
              Запросить новую ссылку
              <ButtonDot>→</ButtonDot>
            </Link>
          </div>
        </DiarySheet>
      </main>
    </Cover>
  );
}
