import { KeepInTouchList } from "@/components/keep-in-touch-list";
import { listOverdueContacts } from "@/db/queries";
import { formatDay, KEEP_IN_TOUCH_LABELS } from "@/lib/format";

// "Пора связаться" above the contact list: contacts whose keep-in-touch
// deadline is over. Not shown while searching or when nobody is overdue.
export async function KeepInTouchBlock({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;

  if (typeof q === "string" && q.trim()) {
    return null;
  }

  const overdue = await listOverdueContacts();

  if (overdue.length === 0) {
    return null;
  }

  return (
    <KeepInTouchList
      items={overdue.map((contact) => ({
        id: contact.id,
        name: contact.name,
        caption: `${
          contact.lastNoteDay
            ? `Не общались с ${formatDay(contact.lastNoteDay)}`
            : "Заметок ещё нет"
        } · ${KEEP_IN_TOUCH_LABELS[contact.every].toLowerCase()}`,
      }))}
    />
  );
}
