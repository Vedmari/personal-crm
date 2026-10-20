"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addNoteAction } from "@/app/actions";
import { DATE_LINE_CLASS_NAME } from "@/components/paper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NOTE_MAX_LENGTH } from "@/lib/validation";

const SAVE_FAILED =
  "Не получилось сохранить заметку. Проверьте, что база данных запущена, и попробуйте ещё раз.";

export function NoteForm({ contactId }: { contactId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Ctrl+Enter submits the form directly and skips the disabled button,
  // so a repeated press during a save has to be stopped here.
  const isSaving = useRef(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving.current) {
      return;
    }

    isSaving.current = true;

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await addNoteAction(contactId, formData);

        if (result.ok) {
          form.reset();
          setError(null);
          toast.success("Заметка сохранена");
          return;
        }

        setError(result.errors.body ?? result.message ?? SAVE_FAILED);
      } catch {
        setError(SAVE_FAILED);
      } finally {
        isSaving.current = false;
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid">
      <label htmlFor="note-body" className="sr-only">
        Новая заметка
      </label>
      {/* Written straight on the rules of the sheet: transparent, 32px lines,
          9px + 1px border on top put the text on the same rules as the page. */}
      <Textarea
        id="note-body"
        name="body"
        placeholder="О чём говорили, что важно не забыть"
        maxLength={NOTE_MAX_LENGTH}
        onKeyDown={handleKeyDown}
        onChange={() => setError(null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "note-body-error" : "note-body-hint"}
        className="max-h-320 min-h-96 rounded-sm border-dashed border-ink-muted/50 bg-transparent px-12 pt-9 pb-21 focus-visible:border-solid"
      />
      {error ? (
        <p
          id="note-body-error"
          role="alert"
          className="mt-10 -mb-10 font-sans text-body text-destructive md:text-body-md"
        >
          {error}
        </p>
      ) : null}
      {/* Two rules: the hint sits on the first one, the button is centred
          on both. Phones have no Ctrl key, so the hint is desktop-only. */}
      <div className="flex h-64 items-start justify-between gap-12">
        <p
          id="note-body-hint"
          className={cn(DATE_LINE_CLASS_NAME, "mt-10 max-md:hidden")}
        >
          Ctrl + Enter — сохранить
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="mt-6 max-md:w-full"
        >
          {isPending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
