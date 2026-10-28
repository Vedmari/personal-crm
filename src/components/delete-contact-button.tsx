"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteContactAction,
  eraseDeletedContactAction,
  restoreContactAction,
} from "@/app/actions";
import { ConfirmDelete, toastWithUndo } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { showContactInList } from "@/lib/reveal-contact";

const RESTORE_FAILED =
  "Не получилось вернуть контакт. Проверьте, что база данных запущена.";

type DeletedContact = { id: number; name: string };

async function restore(
  router: ReturnType<typeof useRouter>,
  contact: DeletedContact,
) {
  try {
    const result = await restoreContactAction(contact.id);

    if (!result.ok) {
      toast.error(result.message ?? RESTORE_FAILED);
      return;
    }

    toast.success(`${contact.name} — снова в списке контактов`);
    showContactInList(router, result.data);
  } catch {
    toast.error(RESTORE_FAILED);
  }
}

// A failed erase is not shown: the next deletion erases the leftovers.
function erase(contact: DeletedContact) {
  eraseDeletedContactAction(contact.id).catch(() => {});
}

export function DeleteContactButton({
  contactId,
  name,
}: {
  contactId: number;
  name: string;
}) {
  const router = useRouter();

  function handleDeleted(contact: DeletedContact) {
    // Replace, not push: "Back" must not lead to the card that is gone.
    router.replace("/");
    toastWithUndo({
      message: `Контакт «${contact.name}» будет удалён! Ошибочка вышла?`,
      onUndo: () => restore(router, contact),
      onExpire: () => erase(contact),
    });
  }

  return (
    <ConfirmDelete
      // On phones only the bin is shown, like the pencil next to it.
      trigger={
        <Button variant="outline" className="max-md:size-40 max-md:p-0" />
      }
      title="Удалить контакт?"
      description={`Контакт «${name}» пропадёт вместе со всеми заметками.`}
      action={() => deleteContactAction(contactId)}
      onDeleted={handleDeleted}
    >
      <Trash2Icon />
      <span className="max-md:sr-only">Удалить</span>
    </ConfirmDelete>
  );
}
