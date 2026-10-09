import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Такой страницы нет
      </h1>
      <p className="text-muted-foreground">
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2" })}>
        Ко всем контактам
      </Link>
    </main>
  );
}
