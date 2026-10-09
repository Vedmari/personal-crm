"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_MAX_LENGTH } from "@/lib/validation";

const SAVE_FAILED =
  "Не получилось сохранить заметку. Проверьте, что база данных запущена, и попробуйте ещё раз.";

export function NoteForm({ contactId }: { contactId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
    <form onSubmit={handleSubmit} noValidate className="grid gap-2">
      <label htmlFor="note-body" className="sr-only">
        Новая заметка
      </label>
      <Textarea
        id="note-body"
        name="body"
        placeholder="О чём говорили, что важно не забыть"
        maxLength={NOTE_MAX_LENGTH}
        onKeyDown={handleKeyDown}
        onChange={() => setError(null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "note-body-error" : "note-body-hint"}
        className="max-h-80 min-h-24 bg-card"
      />
      {error ? (
        <p id="note-body-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p id="note-body-hint" className="text-xs text-muted-foreground">
          Ctrl + Enter — сохранить
        </p>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
