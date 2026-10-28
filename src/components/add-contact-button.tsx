"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createContactAction } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";
import { Button, ButtonDot } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { showContactInList } from "@/lib/reveal-contact";

export function AddContactButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleCreated(contact: {
    id: number;
    name: string;
    position: number | null;
  }) {
    setOpen(false);
    toast.success(`${contact.name} — в списке контактов`);
    showContactInList(router, contact);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Stands next to the "Контакты" heading, so "Добавить" is enough.
          On phones only the dot with the plus is shown: the label does not fit. */}
      <DialogTrigger
        render={
          <Button
            size="lg"
            aria-label="Добавить контакт"
            className="max-md:size-52 max-md:p-0"
          />
        }
      >
        <span className="max-md:sr-only">Добавить</span>
        <ButtonDot className="max-md:mr-0">
          <PlusIcon />
        </ButtonDot>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
          <DialogDescription>
            Обязательно только имя — остальное можно дописать позже.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          action={createContactAction}
          submitLabel="Добавить"
          pendingLabel="Добавляю…"
          onSuccess={handleCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
