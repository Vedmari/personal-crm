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
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <PencilIcon data-icon="inline-start" />
        Изменить
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
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
