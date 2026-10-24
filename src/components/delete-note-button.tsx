"use client";

import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  deleteNoteAction,
  eraseDeletedNoteAction,
  restoreNoteAction,
} from "@/app/actions";
import { ConfirmDelete, toastWithUndo } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";

const RESTORE_FAILED =
  "Не получилось вернуть заметку. Проверьте, что база данных запущена.";

async function restore(noteId: number) {
  try {
    const result = await restoreNoteAction(noteId);

    if (!result.ok) {
      toast.error(result.message ?? RESTORE_FAILED);
      return;
    }

    toast.success("Заметка снова в ленте");
  } catch {
    toast.error(RESTORE_FAILED);
  }
}

// A failed erase is not shown: the next deletion erases the leftovers.
function erase(noteId: number) {
  eraseDeletedNoteAction(noteId).catch(() => {});
}

export function DeleteNoteButton({
  noteId,
  dateLabel,
}: {
  noteId: number;
  // The note's date as shown above it, e.g. "10 октября 2025 · 12:04".
  dateLabel: string;
}) {
  function handleDeleted() {
    toastWithUndo({
      message: "Заметка будет удалена! Ошибочка вышла?",
      onUndo: () => restore(noteId),
      onExpire: () => erase(noteId),
    });
  }

  return (
    <ConfirmDelete
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Удалить заметку от ${dateLabel}`}
        />
      }
      title="Удалить заметку?"
      description={`Заметка от ${dateLabel} пропадёт из ленты.`}
      action={() => deleteNoteAction(noteId)}
      onDeleted={handleDeleted}
    >
      <Trash2Icon />
    </ConfirmDelete>
  );
}
