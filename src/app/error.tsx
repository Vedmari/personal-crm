"use client";

import { useEffect } from "react";

import {
  STICKER_TEXT_CLASS_NAME,
  StickerNote,
} from "@/components/sticker-note";
import { Button, ButtonDot } from "@/components/ui/button";

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
    <StickerNote title="Не получилось загрузить данные">
      <p className={STICKER_TEXT_CLASS_NAME}>
        Скорее всего, не запущена база данных. Запустите Podman Desktop,
        выполните в папке проекта команду{" "}
        <code className="rounded-sm bg-ink-strong/8 px-6 py-2 font-mono text-cta font-normal whitespace-nowrap text-ink-strong">
          podman compose up -d
        </code>{" "}
        и попробуйте снова.
      </p>
      <Button
        size="lg"
        className="mt-8 self-start md:mt-12"
        onClick={() => retry()}
      >
        Попробовать снова
        <ButtonDot>↻</ButtonDot>
      </Button>
    </StickerNote>
  );
}
