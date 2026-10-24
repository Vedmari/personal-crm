"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { markContactedAction, undoMarkContactedAction } from "@/app/actions";
import { toastWithUndo } from "@/components/confirm-delete";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";

export type KeepInTouchItem = {
  id: number;
  name: string;
  // "Не общались с 10 сентября · раз в месяц"
  caption: string;
};

const VISIBLE_AT_FIRST = 5;

const SAVE_FAILED =
  "Не получилось отметить. Проверьте, что база данных запущена, и попробуйте ещё раз.";

const UNDO_FAILED =
  "Не получилось отменить. Проверьте, что база данных запущена.";

async function undo(noteId: number) {
  try {
    const result = await undoMarkContactedAction(noteId);

    if (!result.ok) {
      toast.error(result.message ?? UNDO_FAILED);
      return;
    }

    toast.success("Отметка снята");
  } catch {
    toast.error(UNDO_FAILED);
  }
}

// Next.js keeps the previous page hidden in the DOM, so only visible
// elements are candidates.
function findVisible(selector: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (element) => element.offsetParent !== null,
  );
}

// The row with the pressed button disappears, so the focus moves on: to
// "Связались" of the next row, else of the previous one, else to the search.
function moveFocus(nextId: number | undefined) {
  requestAnimationFrame(() => {
    const target =
      (nextId === undefined
        ? undefined
        : findVisible(`[data-contacted-for="${nextId}"]`)) ??
      findVisible('input[role="searchbox"]');

    target?.focus();
  });
}

export function KeepInTouchList({ items }: { items: KeepInTouchItem[] }) {
  const [expanded, setExpanded] = useState(false);
  // A row disappears as soon as "Связались" is pressed and comes back if
  // saving fails.
  const [shown, hide] = useOptimistic(items, (current, id: number) =>
    current.filter((item) => item.id !== id),
  );
  const [, startTransition] = useTransition();

  if (shown.length === 0) {
    return null;
  }

  const visible = expanded ? shown : shown.slice(0, VISIBLE_AT_FIRST);

  function handleContacted(item: KeepInTouchItem) {
    const index = shown.indexOf(item);
    const neighbour = shown[index + 1] ?? shown[index - 1];

    startTransition(async () => {
      hide(item.id);
      moveFocus(neighbour?.id);

      try {
        const result = await markContactedAction(item.id);

        if (!result.ok) {
          toast.error(result.message ?? SAVE_FAILED);
          return;
        }

        toastWithUndo({
          message: `${item.name}: отметили, что связались`,
          undoLabel: "Отменить",
          onUndo: () => undo(result.data.noteId),
          // The note stays: pressing "Связались" is the mark itself.
          onExpire: () => {},
        });
      } catch {
        toast.error(SAVE_FAILED);
      }
    });
  }

  return (
    <section aria-labelledby="keep-in-touch-heading" className="mb-row">
      <h2
        id="keep-in-touch-heading"
        className="font-serif text-feature font-bold text-ink-strong md:text-feature-md"
      >
        Пора связаться
      </h2>
      <ul>
        {visible.map((item) => (
          // Two rules: the name on the first, the caption on the second. On
          // phones a long caption takes a third rule instead of being cut.
          // No id here: revealContact looks for `contact-<id>` in the list below.
          <li key={item.id} className="flex items-center gap-8">
            <Link
              href={`/contacts/${item.id}`}
              className="flex min-h-64 min-w-0 flex-1 items-center gap-12 rounded-md px-8 transition-colors hover:bg-ink-strong/5 focus-visible:bg-ink-strong/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:gap-16"
            >
              <ContactAvatar name={item.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-body font-bold text-ink-strong md:text-body-md">
                  {item.name}
                </span>
                <span className="line-clamp-2 font-sans text-body text-ink-muted md:line-clamp-1 md:text-body-md">
                  {item.caption}
                </span>
              </span>
            </Link>
            {/* Next to the link, not inside it: a press must not open the card.
                On phones only the tick is shown, like "Добавить" and "Изменить". */}
            <Button
              variant="outline"
              data-contacted-for={item.id}
              aria-label={`Связались: ${item.name}`}
              onClick={() => handleContacted(item)}
              className="max-md:size-40 max-md:p-0"
            >
              <CheckIcon />
              <span className="max-md:sr-only">Связались</span>
            </Button>
          </li>
        ))}
      </ul>
      {shown.length > VISIBLE_AT_FIRST ? (
        <Button
          variant="link"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="h-row px-8 text-body md:text-body-md"
        >
          {expanded ? "Свернуть" : `Показать все ${shown.length}`}
        </Button>
      ) : null}
    </section>
  );
}
