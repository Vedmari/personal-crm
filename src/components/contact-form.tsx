"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_LIMITS,
  type ContactField,
  type ContactInput,
  type FieldErrors,
} from "@/lib/validation";

const EMPTY_VALUES: ContactInput = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  agreements: "",
};

const SAVE_FAILED =
  "Не получилось сохранить. Проверьте, что база данных запущена, и попробуйте ещё раз.";

type TextFieldConfig = {
  name: Exclude<ContactField, "agreements">;
  label: string;
  placeholder: string;
  type?: "text" | "tel" | "email";
  required?: boolean;
  half?: boolean;
};

const TEXT_FIELDS: TextFieldConfig[] = [
  {
    name: "name",
    label: "Имя",
    placeholder: "Например, Анна Смирнова",
    required: true,
  },
  {
    name: "about",
    label: "Кто это",
    placeholder: "Коллега, сосед, тренер по плаванию",
  },
  {
    name: "howWeMet",
    label: "Откуда знакомы",
    placeholder: "Где и когда познакомились",
  },
  {
    name: "phone",
    label: "Телефон",
    placeholder: "+7 900 000-00-00",
    type: "tel",
    half: true,
  },
  {
    name: "email",
    label: "Почта",
    placeholder: "name@example.com",
    type: "email",
    half: true,
  },
];

// The order of fields on screen, top to bottom.
const FIELD_ORDER: ContactField[] = [
  ...TEXT_FIELDS.map((field) => field.name),
  "agreements",
];

export function ContactForm<Data>({
  initialValues = EMPTY_VALUES,
  submitLabel,
  pendingLabel,
  action,
  onSuccess,
}: {
  initialValues?: ContactInput;
  submitLabel: string;
  pendingLabel: string;
  action: (formData: FormData) => Promise<ActionResult<ContactField, Data>>;
  onSuccess: (data: Data) => void;
}) {
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (result.ok) {
          onSuccess(result.data);
          return;
        }

        setErrors(result.errors);
        setFormError(result.message ?? null);

        // Move the cursor to the first field that needs fixing.
        const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);

        if (firstInvalid) {
          form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
        }
      } catch {
        setFormError(SAVE_FAILED);
      }
    });
  }

  // An error message disappears as soon as its field is edited.
  function handleChange(event: React.ChangeEvent<HTMLFormElement>) {
    const field = (event.target as { name?: string }).name as
      | ContactField
      | undefined;

    if (field && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={handleChange}
      noValidate
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => {
          const id = `contact-${field.name}`;
          const error = errors[field.name];

          return (
            <div
              key={field.name}
              className={
                field.half
                  ? "grid content-start gap-1.5"
                  : "grid content-start gap-1.5 sm:col-span-2"
              }
            >
              <Label htmlFor={id} className="gap-0.5">
                {field.label}
                {field.required ? (
                  <span aria-hidden="true" className="text-brand">
                    *
                  </span>
                ) : null}
              </Label>
              <Input
                id={id}
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={initialValues[field.name]}
                placeholder={field.placeholder}
                maxLength={CONTACT_LIMITS[field.name]}
                required={field.required}
                autoComplete="off"
                autoFocus={field.name === "name"}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="h-9"
              />
              {error ? (
                <p id={`${id}-error`} className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="contact-agreements">О чём договорились</Label>
          <Textarea
            id="contact-agreements"
            name="agreements"
            defaultValue={initialValues.agreements}
            placeholder="Обещания, планы, долги — всё, что важно не забыть"
            maxLength={CONTACT_LIMITS.agreements}
            aria-invalid={errors.agreements ? true : undefined}
            aria-describedby={
              errors.agreements ? "contact-agreements-error" : undefined
            }
            className="max-h-48 min-h-20"
          />
          {errors.agreements ? (
            <p
              id="contact-agreements-error"
              className="text-sm text-destructive"
            >
              {errors.agreements}
            </p>
          ) : null}
        </div>
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" />}>
          Отмена
        </DialogClose>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
