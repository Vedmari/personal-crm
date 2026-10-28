"use client";

import { useId, useState, useTransition } from "react";

import { createGroupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CREATE_FAILED =
  "Не получилось создать группу. Проверьте, что база данных запущена, и попробуйте ещё раз.";

// The field above the list on the "Группы" page. The input is 48px tall inside
// a row two rules (64px) tall; an error takes one more rule under it.
export function GroupCreateForm() {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await createGroupAction(formData);

        if (result.ok) {
          form.reset();
          setError(null);
          return;
        }

        setError(result.errors.name ?? result.message ?? CREATE_FAILED);
      } catch {
        setError(CREATE_FAILED);
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex h-64 items-center gap-12"
      >
        <Input
          name="name"
          autoComplete="off"
          placeholder="Новая группа"
          aria-label="Название новой группы"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="max-w-440 flex-1"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Создаю…" : "Создать"}
        </Button>
      </form>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-body text-destructive md:text-body-md"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
