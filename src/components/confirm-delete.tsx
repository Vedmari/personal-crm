"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DELETE_FAILED =
  "Не получилось удалить. Проверьте, что база данных запущена, и попробуйте ещё раз.";

const UNDO_TOAST_MS = 10_000;

// A delete button that asks first. "Отмена" comes first in the markup,
// so it gets the focus when the dialog opens and Enter does not delete.
export function ConfirmDelete<Data>({
  trigger,
  children,
  title,
  description,
  action,
  onDeleted,
}: {
  trigger: React.ReactElement;
  children: React.ReactNode;
  title: string;
  description: string;
  action: () => Promise<ActionResult<never, Data>>;
  onDeleted: (data: Data) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await action();

        if (result.ok) {
          setOpen(false);
          onDeleted(result.data);
          return;
        }

        setError(result.message ?? DELETE_FAILED);
      } catch {
        setError(DELETE_FAILED);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="mt-16 font-sans text-body text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" size="lg" />}>
            Отмена
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Удаляю…" : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The toast after a deletion: "Вернуть" stays for 10 seconds (longer while
// the pointer is over it or the tab is hidden). `onExpire` runs when the toast
// closes by itself or is swiped away; pressing "Вернуть" runs only `onUndo`.
export function toastWithUndo({
  message,
  onUndo,
  onExpire,
}: {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
}) {
  toast(message, {
    duration: UNDO_TOAST_MS,
    action: { label: "Вернуть", onClick: onUndo },
    onAutoClose: onExpire,
    onDismiss: onExpire,
  });
}
