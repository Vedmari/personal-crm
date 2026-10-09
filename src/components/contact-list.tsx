import { SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listContacts, type ContactListItem } from "@/db/queries";
import { formatCount, getGroupLetter, pluralize } from "@/lib/format";

const CONTACT_FORMS = ["контакт", "контакта", "контактов"] as const;

// A non-breaking space: keeps the height of a line that has no text.
const EMPTY_CELL = String.fromCharCode(160);

function groupByLetter(
  items: ContactListItem[],
): { letter: string; items: ContactListItem[] }[] {
  const groups: { letter: string; items: ContactListItem[] }[] = [];

  // Items arrive sorted by name, so equal letters are always adjacent.
  for (const item of items) {
    const letter = getGroupLetter(item.name);
    const last = groups[groups.length - 1];

    if (last?.letter === letter) {
      last.items.push(item);
    } else {
      groups.push({ letter, items: [item] });
    }
  }

  return groups;
}

function ContactRow({ contact }: { contact: ContactListItem }) {
  return (
    <li id={`contact-${contact.id}`} className="contact-row">
      <Link
        href={`/contacts/${contact.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ContactAvatar name={contact.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{contact.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {contact.about || EMPTY_CELL}
          </span>
        </span>
        <span className="hidden max-w-[42%] shrink-0 text-right text-sm text-muted-foreground tabular-nums sm:block">
          <span className="block truncate">{contact.phone || EMPTY_CELL}</span>
          <span className="block truncate">{contact.email || EMPTY_CELL}</span>
        </span>
      </Link>
    </li>
  );
}

export async function ContactList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const { items, total } = await listContacts(search);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <UsersIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="text-lg font-medium">Пока нет ни одного контакта</p>
        <p className="max-w-sm text-muted-foreground">
          Нажмите «Добавить контакт», чтобы записать первого человека.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <SearchXIcon
          aria-hidden="true"
          className="size-8 text-muted-foreground"
        />
        <p className="text-lg font-medium break-all">
          По запросу «{search}» никого не нашлось
        </p>
        <p className="max-w-sm text-muted-foreground">
          Поиск идёт по имени. Проверьте написание или{" "}
          <Link
            href="/"
            className="text-foreground underline underline-offset-4 hover:text-brand"
          >
            покажите все контакты
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <p
        aria-live="polite"
        className="px-3 pb-2 text-sm text-muted-foreground tabular-nums"
      >
        {search
          ? `Найдено ${formatCount(items.length)} из ${formatCount(total)}`
          : `${formatCount(total)} ${pluralize(total, CONTACT_FORMS)}`}
      </p>
      <div className="pb-16">
        {groupByLetter(items).map((group) => (
          <section
            key={group.letter}
            aria-label={`Контакты на букву ${group.letter}`}
            className="grid grid-cols-[2rem_minmax(0,1fr)] border-t py-2 first:border-t-0 sm:grid-cols-[3rem_minmax(0,1fr)]"
          >
            <h2
              aria-hidden="true"
              className="sticky top-34 h-10 self-start pt-3.5 text-center text-lg leading-none font-semibold text-brand"
            >
              {group.letter}
            </h2>
            <ul>
              {group.items.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

export function ContactListSkeleton() {
  return (
    <div aria-hidden="true" className="pb-16">
      <Skeleton className="mx-3 mb-4 h-4 w-32" />
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5 sm:pl-15">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
