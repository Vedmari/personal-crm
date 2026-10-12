"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Не получилось загрузить данные
      </h1>
      <p className="text-muted-foreground">
        Скорее всего, не запущена база данных. Запустите Podman Desktop,
        выполните в папке проекта команду{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
          podman compose up -d
        </code>{" "}
        и попробуйте снова.
      </p>
      <Button size="lg" className="mt-2" onClick={() => retry()}>
        Попробовать снова
      </Button>
    </main>
  );
}
