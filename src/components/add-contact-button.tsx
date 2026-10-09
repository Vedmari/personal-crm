"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createContactAction } from "@/app/actions";
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
import { revealContact } from "@/lib/reveal-contact";

export function AddContactButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleCreated(contact: { id: number; name: string }) {
    setOpen(false);
    toast.success(`${contact.name} — в списке контактов`);

    // A search filter could hide the new contact, so it is cleared first.
    if (window.location.search) {
      router.replace("/", { scroll: false });
    }

    revealContact(contact.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <PlusIcon data-icon="inline-start" />
        Добавить контакт
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
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
