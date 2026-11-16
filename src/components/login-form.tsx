"use client";

import { useId, useState, useTransition } from "react";

import { requestLoginLinkAction } from "@/app/auth-actions";
import { Button, ButtonDot } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REQUEST_FAILED =
  "Не получилось запросить ссылку. Проверьте, что приложение и база данных запущены, и попробуйте ещё раз.";

type FormState =
  | { kind: "idle" }
  | { kind: "sent"; email: string }
  | { kind: "field-error"; message: string }
  | { kind: "error"; message: string };

// «Почта» and «Получить ссылку». The messages go under the button; after a
// link is sent the form stays, so a mistyped address can be put right.
export function LoginForm() {
  const fieldId = useId();
  const fieldErrorId = useId();
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await requestLoginLinkAction(formData);

        if (result.ok) {
          setState({ kind: "sent", email: result.data.email });
        } else if (result.errors.email) {
          setState({ kind: "field-error", message: result.errors.email });
        } else {
          setState({
            kind: "error",
            message: result.message ?? REQUEST_FAILED,
          });
        }
      } catch {
        setState({ kind: "error", message: REQUEST_FAILED });
      }
    });
  }

  const fieldError = state.kind === "field-error" ? state.message : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-440">
      <Label htmlFor={fieldId}>Почта</Label>
      <Input
        id={fieldId}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="anna@example.com"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? fieldErrorId : undefined}
      />
      {fieldError ? (
        <p
          id={fieldErrorId}
          role="alert"
          className="mt-16 font-sans text-body text-destructive"
        >
          {fieldError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending} className="mt-16">
        {isPending ? "Отправляю…" : "Получить ссылку"}
        <ButtonDot>→</ButtonDot>
      </Button>
      {/* Present from the start, so a screen reader announces what comes. */}
      <p
        role="status"
        className="mt-row font-sans text-body text-pretty text-ink-body md:text-body-md"
      >
        {state.kind === "sent"
          ? `Ссылка для входа отправлена на ${state.email}`
          : null}
      </p>
      {state.kind === "error" ? (
        <p
          role="alert"
          className="font-sans text-body text-pretty text-destructive md:text-body-md"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
