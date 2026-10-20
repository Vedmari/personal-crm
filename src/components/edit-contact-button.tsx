"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateContactAction } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ContactInput } from "@/lib/validation";

export function EditContactButton({
  contactId,
  updatedAt,
  values,
}: {
  contactId: number;
  // When `values` were last saved: lets the server notice a newer save
  // made in another tab.
  updatedAt: string;
  values: ContactInput;
}) {
  const [open, setOpen] = useState(false);

  function handleSaved() {
    setOpen(false);
    toast.success("Изменения сохранены");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* On phones only the pencil is shown, so the back link fits next to it. */}
      <DialogTrigger
        render={<Button variant="outline" className="max-md:size-40 max-md:p-0" />}
      >
        <PencilIcon />
        <span className="max-md:sr-only">Изменить</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить контакт</DialogTitle>
          <DialogDescription>
            Заметки остаются как есть — здесь только данные контакта.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          initialValues={values}
          action={(formData) =>
            updateContactAction(contactId, updatedAt, formData)
          }
          submitLabel="Сохранить"
          pendingLabel="Сохраняю…"
          onSuccess={handleSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
