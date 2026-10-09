import {
  ArrowLeftIcon,
  HandshakeIcon,
  MailIcon,
  PhoneIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContactAvatar } from "@/components/contact-avatar";
import { EditContactButton } from "@/components/edit-contact-button";
import { NoteForm } from "@/components/note-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact, listNotes } from "@/db/queries";
import { formatNoteDate, toTelHref } from "@/lib/format";
import { parseContactId } from "@/lib/validation";

export default function ContactPage(props: PageProps<"/contacts/[id]">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16 sm:px-6">
      <Link
        href="/"
        className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Все контакты
      </Link>
      <main className="mt-6">
        <Suspense fallback={<ContactCardSkeleton />}>
          <ContactCard params={props.params} />
        </Suspense>
      </main>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words">
          {children || <span className="text-muted-foreground">не указано</span>}
        </dd>
      </div>
    </div>
  );
}

const DETAIL_LINK_CLASS_NAME =
  "rounded-sm underline decoration-border underline-offset-4 outline-none transition-colors hover:decoration-brand focus-visible:ring-3 focus-visible:ring-ring/50";

async function ContactCard({
  params,
}: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id: rawId } = await params;
  const id = parseContactId(rawId);

  if (id === null) {
    notFound();
  }

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);

  if (!contact) {
    notFound();
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <ContactAvatar name={contact.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {contact.name}
          </h1>
          {contact.about ? (
            <p className="mt-1 break-words text-muted-foreground">
              {contact.about}
            </p>
          ) : null}
        </div>
        <EditContactButton
          contactId={contact.id}
          values={{
            name: contact.name,
            about: contact.about,
            howWeMet: contact.howWeMet,
            phone: contact.phone,
            email: contact.email,
            agreements: contact.agreements,
          }}
        />
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid gap-4">
          <dl className="divide-y rounded-2xl border bg-card">
            <DetailRow icon={PhoneIcon} label="Телефон">
              {contact.phone ? (
                <a
                  href={toTelHref(contact.phone)}
                  className={`${DETAIL_LINK_CLASS_NAME} tabular-nums`}
                >
                  {contact.phone}
                </a>
              ) : null}
            </DetailRow>
            <DetailRow icon={MailIcon} label="Почта">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className={`${DETAIL_LINK_CLASS_NAME} break-all`}
                >
                  {contact.email}
                </a>
              ) : null}
            </DetailRow>
            <DetailRow icon={UsersIcon} label="Откуда знакомы">
              {contact.howWeMet}
            </DetailRow>
          </dl>

          <section
            aria-labelledby="agreements-heading"
            className="rounded-2xl bg-highlight px-4 py-3 text-highlight-foreground"
          >
            <h2
              id="agreements-heading"
              className="flex items-center gap-2 text-xs font-medium"
            >
              <HandshakeIcon aria-hidden="true" className="size-4" />
              О чём договорились
            </h2>
            <p className="mt-1.5 break-words whitespace-pre-wrap text-foreground">
              {contact.agreements || (
                <span className="text-highlight-foreground/80">
                  Пока ничего. Нажмите «Изменить», чтобы записать.
                </span>
              )}
            </p>
          </section>
        </div>

        <section aria-labelledby="notes-heading">
          <h2
            id="notes-heading"
            className="flex items-baseline gap-2 text-lg font-semibold"
          >
            Заметки
            {notes.length > 0 ? (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {notes.length}
              </span>
            ) : null}
          </h2>
          <div className="mt-3">
            <NoteForm contactId={contact.id} />
          </div>

          {notes.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Заметок пока нет. Запишите, о чём говорили, — всё останется в
              этой карточке.
            </p>
          ) : (
            <ol className="mt-6 grid gap-3">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-2xl border bg-card px-4 py-3"
                >
                  <time
                    dateTime={note.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatNoteDate(note.createdAt)}
                  </time>
                  <p className="mt-1 break-words whitespace-pre-wrap">
                    {note.body}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function ContactCardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
