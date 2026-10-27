"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteGroupAction, renameGroupAction } from "@/app/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCount, pluralize } from "@/lib/format";
import { listHref } from "@/lib/list-filter";

const RENAME_FAILED =
  "Не получилось переименовать группу. Проверьте, что база данных запущена, и попробуйте ещё раз.";

const CONTACT_FORMS = ["контакт", "контакта", "контактов"] as const;

// One group on the "Группы" page: two rules tall (name, then size), with
// "Переименовать" and "Удалить" on the right. "Переименовать" turns the row
// into a field. The name leads to the contact list with this group chosen.
export function GroupRow({
  id,
  name,
  contactCount,
}: {
  id: number;
  name: string;
  contactCount: number;
}) {
  const errorId = useId();
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function stopRenaming() {
    setIsRenaming(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const result = await renameGroupAction(id, formData);

        if (result.ok) {
          stopRenaming();
          return;
        }

        setError(result.errors.name ?? result.message ?? RENAME_FAILED);
      } catch {
        setError(RENAME_FAILED);
      }
    });
  }

  if (isRenaming) {
    return (
      <li>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-64 flex-wrap items-center gap-8"
        >
          <Input
            name="name"
            defaultValue={name}
            autoFocus
            autoComplete="off"
            aria-label={`Новое название группы «${name}»`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                stopRenaming();
              }
            }}
            className="basis-full md:max-w-440 md:basis-auto md:flex-1"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Сохраняю…" : "Сохранить"}
          </Button>
          <Button type="button" variant="outline" onClick={stopRenaming}>
            Отмена
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
      </li>
    );
  }

  return (
    <li className="flex min-h-64 items-center gap-12">
      <Link
        href={listHref({ group: id })}
        className="min-w-0 flex-1 rounded-md px-8 transition-colors hover:bg-ink-strong/5 focus-visible:bg-ink-strong/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="block truncate font-serif text-body font-bold text-ink-strong md:text-body-md">
          {name}
        </span>
        <span className="block truncate font-sans text-body text-ink-muted lining-nums tabular-nums md:text-body-md">
          {formatCount(contactCount)} {pluralize(contactCount, CONTACT_FORMS)}
        </span>
      </Link>
      <div className="flex gap-8">
        {/* On phones only the icons are shown, like on the contact card. */}
        <Button
          type="button"
          variant="outline"
          className="max-md:size-40 max-md:p-0"
          onClick={() => setIsRenaming(true)}
        >
          <PencilIcon />
          <span className="max-md:sr-only">Переименовать</span>
          <span className="sr-only"> группу «{name}»</span>
        </Button>
        <ConfirmDelete
          trigger={<Button variant="outline" className="max-md:size-40 max-md:p-0" />}
          title="Удалить группу?"
          description={`Группа «${name}» пропадёт. Контакты из неё останутся в списке.`}
          action={() => deleteGroupAction(id)}
          onDeleted={(group) => toast.success(`Группа «${group.name}» удалена`)}
        >
          <Trash2Icon />
          <span className="max-md:sr-only">Удалить</span>
          <span className="sr-only"> группу «{name}»</span>
        </ConfirmDelete>
      </div>
    </li>
  );
}
