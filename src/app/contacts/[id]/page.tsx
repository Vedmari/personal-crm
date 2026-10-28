import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BookmarkHere } from "@/components/bookmark-ribbon";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactGroupsPicker } from "@/components/contact-groups-picker";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { DeleteNoteButton } from "@/components/delete-note-button";
import { EditContactButton } from "@/components/edit-contact-button";
import { KeepInTouchSelect } from "@/components/keep-in-touch-select";
import { NoteForm } from "@/components/note-form";
import {
  Cover,
  DATE_LINE_CLASS_NAME,
  DIARY_SHEET_X,
  DiarySheet,
} from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getContact,
  getKeepInTouchDue,
  listContactGroups,
  listGroups,
  listNotes,
} from "@/db/queries";
import { formatDay, formatNoteDate, pluralize, toTelHref } from "@/lib/format";
import { listHref } from "@/lib/list-filter";
import { cn } from "@/lib/utils";
import { parseId } from "@/lib/validation";

const NOTE_FORMS = ["заметка", "заметки", "заметок"] as const;

// Text on the sheets sits on their 32px rules: a line starts 10px below
// a rule boundary, and every block takes a whole number of rules.
export default function ContactPage(props: PageProps<"/contacts/[id]">) {
  return (
    <Cover>
      <Suspense fallback={<ContactCardSkeleton />}>
        <ContactCard params={props.params} />
      </Suspense>
    </Cover>
  );
}

// Mobile: label on one rule, value on the next. Desktop: side by side.
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-x-24">
      <dt className={DATE_LINE_CLASS_NAME}>{label}</dt>
      <dd className="font-sans text-body break-words text-ink-body md:text-body-md">
        {children || <span className="text-ink-muted">не указано</span>}
      </dd>
    </div>
  );
}

const DETAIL_LINK_CLASS_NAME =
  "rounded-sm text-ink-strong underline decoration-ink-muted/50 underline-offset-4 transition-colors hover:decoration-book-cover focus-visible:outline-2 focus-visible:outline-ring";

const BACK_LINK = (
  <Link
    href="/"
    transitionTypes={["page-back"]}
    className={cn(
      DATE_LINE_CLASS_NAME,
      "flex w-fit items-center gap-8 rounded-sm whitespace-nowrap transition-colors hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-ring",
    )}
  >
    <span aria-hidden="true" className="text-arrow normal-case">
      ←
    </span>
    Все контакты
  </Link>
);

async function ContactCard({
  params,
}: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (id === null) {
    notFound();
  }

  const [contact, notes, due, contactGroups, allGroups] = await Promise.all([
    getContact(id),
    listNotes(id),
    getKeepInTouchDue(id),
    listContactGroups(id),
    listGroups(),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-40 md:gap-80">
      <BookmarkHere id={contact.id} name={contact.name} />
      <DiarySheet>
        <div className={cn(DIARY_SHEET_X, "pt-42 pb-56 md:pb-70")}>
          {/* One rule: the buttons are taller than the line and overlap it a bit. */}
          <div className="flex h-row items-center justify-between gap-16">
            {BACK_LINK}
            <div className="-my-4 flex gap-8">
              <DeleteContactButton contactId={contact.id} name={contact.name} />
              <EditContactButton
                contactId={contact.id}
                updatedAt={contact.updatedAt.toISOString()}
                values={{
                  name: contact.name,
                  about: contact.about,
                  howWeMet: contact.howWeMet,
                  phone: contact.phone,
                  email: contact.email,
                  agreements: contact.agreements,
                }}
              />
            </div>
          </div>

          {/* grid-cols-1 is minmax(0, 1fr): without it the phone column grows
              to the longest word of the name and the sheet is cut off on the right. */}
          <div className="mt-row grid grid-cols-1 items-start gap-x-56 gap-y-row lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <div>
              {/* Phones: the avatar (two rules tall) sits above the name, so the
                  name gets the full width of the sheet. Wider screens: side by side. */}
              <header className="flex flex-col items-start md:flex-row md:gap-24">
                <ContactAvatar name={contact.name} size="lg" />
                <div className="w-full min-w-0 md:w-auto md:flex-1">
                  {/* Struck out in red ink when the contact is deleted. */}
                  <h1
                    data-ink-for={`contact-${contact.id}`}
                    className="relative -top-7 font-serif text-h2 font-medium break-words text-ink md:-top-9 md:text-h2-md"
                  >
                    <span data-ink-text>{contact.name}</span>
                  </h1>
                  {contact.about ? (
                    <p className="font-sans text-lead break-words text-ink-body md:text-lead-md">
                      {contact.about}
                    </p>
                  ) : null}
                </div>
              </header>

              <dl className="mt-row flex flex-col">
                <DetailRow label="Телефон">
                  {contact.phone ? (
                    <a
                      href={toTelHref(contact.phone)}
                      className={cn(
                        DETAIL_LINK_CLASS_NAME,
                        "lining-nums tabular-nums",
                      )}
                    >
                      {contact.phone}
                    </a>
                  ) : null}
                </DetailRow>
                <DetailRow label="Почта">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className={cn(DETAIL_LINK_CLASS_NAME, "break-all")}
                    >
                      {contact.email}
                    </a>
                  ) : null}
                </DetailRow>
                <DetailRow label="Откуда знакомы">{contact.howWeMet}</DetailRow>
                {/* The select is one rule tall; the deadline goes on the next rule. */}
                <DetailRow label="Как часто общаться">
                  <KeepInTouchSelect
                    key={contact.keepInTouchEvery ?? "none"}
                    contactId={contact.id}
                    every={contact.keepInTouchEvery}
                  />
                  {due ? (
                    due.overdueDays > 0 ? (
                      <span className="block text-ink-red">
                        Пора связаться: срок был {formatDay(due.dueDay)}
                      </span>
                    ) : (
                      <span className="block">
                        Связаться не позже {formatDay(due.dueDay)}
                      </span>
                    )
                  ) : null}
                </DetailRow>
                {/* Each item is one rule tall, so wrapped lines stay on the rules. */}
                <DetailRow label="Группы">
                  <div className="flex flex-wrap items-center gap-x-16">
                    {contactGroups.length > 0 ? (
                      contactGroups.map((group) => (
                        <Link
                          key={group.id}
                          href={listHref({ group: group.id })}
                          className={cn(DETAIL_LINK_CLASS_NAME, "break-all")}
                        >
                          {group.name}
                        </Link>
                      ))
                    ) : (
                      <span className="text-ink-muted">не указано</span>
                    )}
                    <ContactGroupsPicker
                      contactId={contact.id}
                      groups={allGroups.map(({ id, name }) => ({ id, name }))}
                      memberIds={contactGroups.map((group) => group.id)}
                    />
                  </div>
                </DetailRow>
              </dl>
            </div>

            {/* A sticky note on the page: agreements stay in sight, apart from the notes. */}
            <section
              aria-labelledby="agreements-heading"
              className="flex max-w-440 rotate-2 flex-col gap-10 bg-sticker paper-sticker px-24 pt-24 pb-26 shadow-sticker md:shadow-sticker-md lg:mt-8 lg:max-w-none"
            >
              <h2
                id="agreements-heading"
                className="font-serif text-feature font-medium text-ink md:text-feature-md"
              >
                О чём договорились
              </h2>
              {contact.agreements ? (
                <p className="font-hand text-sticker-note font-bold break-words whitespace-pre-wrap text-ink-blue">
                  {contact.agreements}
                </p>
              ) : (
                <p className="font-sans text-body text-pretty text-ink-muted">
                  Пока ничего. Нажмите «Изменить», чтобы записать.
                </p>
              )}
            </section>
          </div>
        </div>
      </DiarySheet>

      {/* A lined page torn out of a spiral notebook, as on the landing. */}
      <section
        aria-labelledby="notes-heading"
        className="mr-14 ml-18 drop-shadow-sheet md:mr-problem-r md:ml-problem-l md:max-w-900 md:drop-shadow-sheet-md"
      >
        <div className="relative flex flex-col bg-paper paper-lined ring-holes torn-bottom pt-42 pr-72 pb-46 pl-30 md:pr-sheet-r md:pb-54 md:pl-sheet-l">
          <p className={DATE_LINE_CLASS_NAME}>
            {notes.length > 0
              ? `${notes.length} ${pluralize(notes.length, NOTE_FORMS)} · новые сверху`
              : "Лента заметок"}
          </p>
          <h2
            id="notes-heading"
            className="relative -top-7 mt-row font-serif text-h2 font-medium text-ink md:-top-9 md:text-h2-md"
          >
            Заметки
          </h2>
          {/* The heading ends 22px before a rule boundary (it is one rule tall
              on phones, two on desktop); the form starts on that boundary. */}
          <div className="mt-22">
            <NoteForm contactId={contact.id} />
          </div>

          {notes.length === 0 ? (
            <p className="mt-42 font-sans text-body text-pretty text-ink-muted md:text-body-md">
              Заметок пока нет. Запишите, о чём говорили, — всё останется в этой
              карточке.
            </p>
          ) : (
            <ol className="mt-42 flex flex-col gap-row">
              {notes.map((note) => (
                <li key={note.id} data-ink-for={`note-${note.id}`}>
                  {/* One rule: the bin is taller than the line and overlaps it a bit. */}
                  <div className="flex h-row items-center justify-between gap-16">
                    <time
                      dateTime={note.createdAt.toISOString()}
                      className={DATE_LINE_CLASS_NAME}
                    >
                      {formatNoteDate(note.createdAt)}
                    </time>
                    <DeleteNoteButton
                      noteId={note.id}
                      dateLabel={formatNoteDate(note.createdAt)}
                    />
                  </div>
                  <p className="font-sans text-body break-words whitespace-pre-wrap text-ink-body md:text-body-md">
                    <span data-ink-text>{note.body}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}

function ContactCardSkeleton() {
  return (
    <div aria-hidden="true">
      <DiarySheet>
        <div className={cn(DIARY_SHEET_X, "pt-42 pb-56 md:pb-70")}>
          <div className="flex h-row items-center">
            <Skeleton className="h-12 w-140" />
          </div>
          <div className="mt-row flex flex-col items-start md:flex-row md:gap-24">
            <Skeleton className="size-64 rounded-full" />
            <div className="w-full space-y-16 pt-8 md:w-auto md:flex-1">
              <Skeleton className="h-28 w-280 max-w-full" />
              <Skeleton className="h-18 w-220 max-w-full" />
            </div>
          </div>
          <div className="mt-row space-y-20 pt-8">
            <Skeleton className="h-16 w-320 max-w-full" />
            <Skeleton className="h-16 w-280 max-w-full" />
            <Skeleton className="h-16 w-300 max-w-full" />
          </div>
        </div>
      </DiarySheet>
    </div>
  );
}
