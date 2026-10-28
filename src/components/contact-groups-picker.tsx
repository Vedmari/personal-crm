"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createGroupForContactAction,
  setContactGroupAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type GroupOption = { id: number; name: string };

const SAVE_FAILED =
  "Не получилось сохранить группы. Проверьте, что база данных запущена, и попробуйте ещё раз.";

const CREATE_FAILED =
  "Не получилось создать группу. Проверьте, что база данных запущена, и попробуйте ещё раз.";

// "В группу" in the contact card: a list of all groups with ticks. A tick is
// saved at once and shows at once; it goes back if saving fails. The field at
// the bottom makes a new group and puts the contact into it.
export function ContactGroupsPicker({
  contactId,
  groups,
  memberIds,
}: {
  contactId: number;
  groups: GroupOption[];
  memberIds: number[];
}) {
  // The ticks follow the server whenever it sends new data (after a save, or
  // when the page refreshes); between those they show what was just clicked.
  const serverKey = memberIds.join(",");
  const [seenKey, setSeenKey] = useState(serverKey);
  const [selected, setSelected] = useState(() => new Set(memberIds));
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const [, startSaving] = useTransition();

  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setSelected(new Set(memberIds));
  }

  function setTick(groupId: number, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);

      if (on) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }

      return next;
    });
  }

  function handleToggle(groupId: number, checked: boolean) {
    setTick(groupId, checked);

    startSaving(async () => {
      try {
        const result = await setContactGroupAction(contactId, groupId, checked);

        if (!result.ok) {
          setTick(groupId, !checked);
          toast.error(result.message ?? SAVE_FAILED);
        }
      } catch {
        setTick(groupId, !checked);
        toast.error(SAVE_FAILED);
      }
    });
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    startCreating(async () => {
      try {
        const result = await createGroupForContactAction(contactId, formData);

        if (result.ok) {
          form.reset();
          setError(null);
          setTick(result.data.id, true);
          return;
        }

        setError(result.errors.name ?? result.message ?? CREATE_FAILED);
      } catch {
        setError(CREATE_FAILED);
      }
    });
  }

  return (
    <Popover onOpenChange={() => setError(null)}>
      {/* On phones only the plus is shown, like on the "Добавить" button. */}
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="h-32 px-12 max-md:size-32 max-md:p-0"
          />
        }
      >
        <PlusIcon />
        <span className="max-md:sr-only">В группу</span>
      </PopoverTrigger>
      <PopoverContent aria-label="Группы контакта">
        {groups.length > 0 ? (
          <ul className="mb-8 flex flex-col">
            {groups.map((group) => (
              <li key={group.id}>
                <label className="flex h-36 cursor-pointer items-center gap-10 rounded-sm px-8 font-sans text-body text-ink hover:bg-ink-strong/6 md:text-body-md">
                  <Checkbox
                    checked={selected.has(group.id)}
                    onCheckedChange={(checked) =>
                      handleToggle(group.id, checked)
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-8 pb-8 font-sans text-body text-pretty text-ink-muted">
            Групп пока нет. Впишите название, и группа появится.
          </p>
        )}
        <form onSubmit={handleCreate} className="flex items-center gap-8">
          <Input
            name="name"
            autoComplete="off"
            placeholder="Новая группа"
            aria-label="Название новой группы"
            aria-invalid={error ? true : undefined}
            className="h-36 py-0"
          />
          <Button type="submit" disabled={isCreating} className="h-36 px-14">
            Создать
          </Button>
        </form>
        {error ? (
          <p
            role="alert"
            className="mt-8 px-4 font-sans text-body text-destructive"
          >
            {error}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
