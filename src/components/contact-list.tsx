import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { DATE_LINE_CLASS_NAME } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { listContacts, type ContactListItem } from "@/db/queries";
import { formatCount, getGroupLetter, pluralize } from "@/lib/format";
import { listHref } from "@/lib/list-filter";
import { readListFilter } from "@/lib/read-list-filter";

const CONTACT_FORMS = ["контакт", "контакта", "контактов"] as const;

const TEXT_LINK_CLASS_NAME =
  "rounded-sm text-ink-strong underline decoration-ink-muted/50 underline-offset-4 hover:decoration-book-cover focus-visible:outline-2 focus-visible:outline-ring";

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

// Two rules of the page: the name on the first, "who this is" on the second.
function ContactRow({ contact }: { contact: ContactListItem }) {
  return (
    <li id={`contact-${contact.id}`} className="contact-row">
      <Link
        href={`/contacts/${contact.id}`}
        className="flex h-64 items-center gap-12 rounded-md px-8 transition-colors hover:bg-ink-strong/5 focus-visible:bg-ink-strong/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:gap-16"
      >
        <ContactAvatar name={contact.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-body font-bold text-ink-strong md:text-body-md">
            {contact.name}
          </span>
          <span className="block truncate font-sans text-body text-ink-muted md:text-body-md">
            {contact.about || EMPTY_CELL}
          </span>
        </span>
        <span className="hidden max-w-[42%] shrink-0 text-right font-sans text-body text-ink-muted lining-nums tabular-nums md:block md:text-body-md">
          <span className="block truncate">{contact.phone || EMPTY_CELL}</span>
          <span className="block truncate">{contact.email || EMPTY_CELL}</span>
        </span>
      </Link>
    </li>
  );
}

// A handwritten mark, like the "?" and "✓" on the margins of the landing sheets.
export function EmptyState({
  mark,
  title,
  children,
}: {
  mark: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8 pt-row pb-row">
      <span
        aria-hidden="true"
        className="w-row flex-none text-center font-hand text-mark font-bold text-ink-red md:text-mark-md"
      >
        {mark}
      </span>
      <div className="min-w-0">
        <p className="relative -top-2 font-serif text-feature font-bold break-words text-ink-strong md:text-feature-md">
          {title}
        </p>
        <p className="max-w-560 font-sans text-body text-pretty text-ink-body md:text-body-md">
          {children}
        </p>
      </div>
    </div>
  );
}

export async function ContactList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { search, group } = await readListFilter(searchParams);
  const { items, total } = await listContacts(search, group?.id ?? null);

  // With a group, `total` is the size of the group, not of the whole book.
  if (total === 0 && group) {
    return (
      <EmptyState mark="?" title={`В группе «${group.name}» пока никого`}>
        Добавьте людей в карточках или{" "}
        <Link href={listHref({ q: search })} className={TEXT_LINK_CLASS_NAME}>
          покажите все контакты
        </Link>
        .
      </EmptyState>
    );
  }

  if (total === 0) {
    return (
      <EmptyState mark="?" title="Пока нет ни одного контакта">
        Нажмите «Добавить контакт», чтобы записать первого человека.
      </EmptyState>
    );
  }

  if (items.length === 0 && group) {
    return (
      <EmptyState
        mark="?"
        title={`В группе «${group.name}» по запросу «${search}» никого не нашлось`}
      >
        Можно{" "}
        <Link href={listHref({ q: search })} className={TEXT_LINK_CLASS_NAME}>
          искать по всем контактам
        </Link>
        .
      </EmptyState>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState mark="?" title={`По запросу «${search}» никого не нашлось`}>
        Поиск идёт по имени и по полю «Кто это». Проверьте написание или{" "}
        <Link href="/" className={TEXT_LINK_CLASS_NAME}>
          покажите все контакты
        </Link>
        .
      </EmptyState>
    );
  }

  const groupSuffix = group ? ` в группе «${group.name}»` : "";
  const counter = search
    ? `Найдено ${formatCount(items.length)} из ${formatCount(total)}${groupSuffix}`
    : group
      ? `В группе «${group.name}» — ${formatCount(total)} ${pluralize(total, CONTACT_FORMS)}`
      : `${formatCount(total)} ${pluralize(total, CONTACT_FORMS)}`;

  return (
    <>
      <p aria-live="polite" className={DATE_LINE_CLASS_NAME}>
        {counter}
      </p>
      {groupByLetter(items).map((group) => (
        // The letter is a margin mark: on phones it hangs in the right margin
        // (-mr-56 reaches over the sheet padding), on desktop it stands left
        // of the names (-ml-48). It sticks under the 64px search bar.
        <section
          key={group.letter}
          aria-label={`Контакты на букву ${group.letter}`}
          className="-mr-56 grid grid-cols-[minmax(0,1fr)_var(--spacing-row)] gap-x-24 md:-ml-48 md:mr-0 md:grid-cols-[var(--spacing-row)_minmax(0,1fr)] md:gap-x-16"
        >
          <h2
            aria-hidden="true"
            className="sticky top-74 order-last h-row self-start text-center font-hand text-mark font-bold text-ink-red md:order-first md:text-mark-md"
          >
            {group.letter}
          </h2>
          {/* Rows skip painting outside their own box (content-visibility),
              so the 8px of hover background around the text is part of the row. */}
          <ul className="-mx-8">
            {group.items.map((contact) => (
              <ContactRow key={contact.id} contact={contact} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function ContactListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex h-row items-center">
        <Skeleton className="h-12 w-120" />
      </div>
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index} className="flex h-64 items-center gap-12 md:gap-16">
          <Skeleton className="size-40 rounded-full" />
          <div className="flex-1 space-y-12">
            <Skeleton className="h-16 w-200 max-w-full" />
            <Skeleton className="h-14 w-260 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
