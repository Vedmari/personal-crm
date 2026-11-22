import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

import { getGroupLetter, MOSCOW_TIME_ZONE } from "@/lib/format";
import { LIST_PAGE_SIZE } from "@/lib/list-filter";
import type { ContactInput } from "@/lib/validation";

import { safeQuery } from "./errors";
import { db } from "./index";
import {
  contactGroups,
  contacts,
  groups,
  notes,
  type KeepInTouchInterval,
} from "./schema";

export type ContactListItem = {
  id: number;
  name: string;
  about: string;
  phone: string;
  email: string;
};

// "ё" and "е" are interchangeable in everyday Russian spelling,
// so search treats them as the same letter.
function normalizeForSearch(value: string): string {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Search looks at the name and at "who this is" (`about`). Every word of the
// query must appear in one of them, so "петров иван" finds "Иван Петров" and
// "анна ветеринар" finds an Anna described as a vet.
function contactMatches(search: string): SQL | undefined {
  const words = normalizeForSearch(search).split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return undefined;
  }

  return and(
    ...words.map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return or(
        sql`replace(lower(${contacts.name}), 'ё', 'е') like ${pattern}`,
        sql`replace(lower(${contacts.about}), 'ё', 'е') like ${pattern}`,
      );
    }),
  );
}

// The database default order ignores spaces, which puts "Александр Яковлев"
// after "Александра Белова". The Russian ICU collation sorts word by word,
// the way a phone book does, and treats "ё" as "е".
const nameInAlphabeticalOrder = sql`${contacts.name} collate "ru-x-icu"`;

// The rows of one user. A note has no owner of its own: it belongs to the
// owner of its contact. Every query takes the owner as its first argument and
// keeps to it, so somebody else's row is the same as a row that is not there.
function ownContact(ownerId: string): SQL {
  return eq(contacts.ownerId, ownerId);
}

function ownNote(ownerId: string): SQL {
  return sql`exists (
    select 1 from ${contacts}
    where ${contacts.id} = ${notes.contactId} and ${contacts.ownerId} = ${ownerId}
  )`;
}

function ownGroup(ownerId: string): SQL {
  return eq(groups.ownerId, ownerId);
}

// Only contacts that are in the group.
function inGroup(groupId: number): SQL {
  return sql`exists (
    select 1 from ${contactGroups}
    where ${contactGroups.contactId} = ${contacts.id} and ${contactGroups.groupId} = ${groupId}
  )`;
}

// With a group, both the list and the total (the "of N" of the counter) are
// about that group's contacts only. `items` are the first `limit` of the
// `matched` ones: the list is shown a hundred at a time.
export const listContacts = safeQuery(
  "listContacts",
  async (
    ownerId: string,
    search: string,
    groupId: number | null = null,
    limit: number = LIST_PAGE_SIZE,
  ): Promise<{
    items: ContactListItem[];
    matched: number;
    total: number;
  }> => {
    const inScope = and(
      ownContact(ownerId),
      isNull(contacts.deletedAt),
      groupId === null ? undefined : inGroup(groupId),
    );
    const matches = contactMatches(search);

    const [items, totals, matchedTotals] = await Promise.all([
      db
        .select({
          id: contacts.id,
          name: contacts.name,
          about: contacts.about,
          phone: contacts.phone,
          email: contacts.email,
        })
        .from(contacts)
        .where(and(inScope, matches))
        .orderBy(nameInAlphabeticalOrder, asc(contacts.id))
        .limit(limit),
      db.select({ value: count() }).from(contacts).where(inScope),
      matches === undefined
        ? null
        : db
            .select({ value: count() })
            .from(contacts)
            .where(and(inScope, matches)),
    ]);
    const total = totals[0]?.value ?? 0;

    return {
      items,
      matched: matchedTotals === null ? total : (matchedTotals[0]?.value ?? 0),
      total,
    };
  },
);

// The letters of the alphabet tabs: every letter the list has, with the place
// of its first contact (the first one is 1), for the same search and group as
// the list. Letters come from getGroupLetter, the same as the letter marks of
// the list, so «Ё» goes with «Е» and names that start with no letter go under
// «#». Only the names are read, in the order of the list.
export const listLetters = safeQuery(
  "listLetters",
  async (
    ownerId: string,
    search: string,
    groupId: number | null = null,
  ): Promise<{ letter: string; position: number }[]> => {
    const rows = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          isNull(contacts.deletedAt),
          groupId === null ? undefined : inGroup(groupId),
          contactMatches(search),
        ),
      )
      .orderBy(nameInAlphabeticalOrder, asc(contacts.id));
    const letters: { letter: string; position: number }[] = [];

    rows.forEach((row, index) => {
      const letter = getGroupLetter(row.name);

      if (letters[letters.length - 1]?.letter !== letter) {
        letters.push({ letter, position: index + 1 });
      }
    });

    return letters;
  },
);

// The place of a contact in the whole alphabetical list, without search or
// group: the first one is 1. The list uses it to load far enough to show a
// contact that was just added or brought back. Null when there is no such
// contact, or it is deleted.
export const contactPosition = safeQuery(
  "contactPosition",
  async (ownerId: string, id: number): Promise<number | null> => {
    const [target] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNull(contacts.deletedAt),
        ),
      )
      .limit(1);

    if (!target) {
      return null;
    }

    // The same order as the list: by name in the Russian collation, then by id.
    const [before] = await db
      .select({ value: count() })
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          isNull(contacts.deletedAt),
          sql`(${nameInAlphabeticalOrder}, ${contacts.id}) < (${target.name} collate "ru-x-icu", ${id})`,
        ),
      );

    return (before?.value ?? 0) + 1;
  },
);

export const getContact = safeQuery(
  "getContact",
  async (ownerId: string, id: number) => {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNull(contacts.deletedAt),
        ),
      )
      .limit(1);

    return rows[0];
  },
);

export const listNotes = safeQuery(
  "listNotes",
  async (ownerId: string, contactId: number) => {
    return db
      .select()
      .from(notes)
      .where(
        and(
          ownNote(ownerId),
          eq(notes.contactId, contactId),
          isNull(notes.deletedAt),
        ),
      )
      .orderBy(desc(notes.createdAt), desc(notes.id));
  },
);

export const createContact = safeQuery(
  "createContact",
  async (ownerId: string, input: ContactInput) => {
    const rows = await db
      .insert(contacts)
      .values({ ...input, ownerId })
      .returning({ id: contacts.id, name: contacts.name });

    return rows[0];
  },
);

export type UpdateContactResult = "updated" | "changed_elsewhere" | "not_found";

// Saves only if the contact has not been saved since the edit form got its
// data. Without this check a tab that was opened earlier would silently
// overwrite newer changes with the old values it still shows.
export const updateContact = safeQuery(
  "updateContact",
  async (
    ownerId: string,
    id: number,
    input: ContactInput,
    expectedUpdatedAt: Date,
  ): Promise<UpdateContactResult> => {
    const rows = await db
      .update(contacts)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNull(contacts.deletedAt),
          // The browser keeps time to the millisecond, the database to the
          // microsecond, so the stored value is cut down before comparing.
          sql`date_trunc('milliseconds', ${contacts.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamptz`,
        ),
      )
      .returning({ id: contacts.id });

    if (rows[0]) {
      return "updated";
    }

    return (await getContact(ownerId, id)) ? "changed_elsewhere" : "not_found";
  },
);

export const listUpcomingBirthdays = safeQuery(
  "listUpcomingBirthdays",
  async (ownerId: string, now: Date = new Date()) => {
    const today = sql`(${now.toISOString()}::timestamptz at time zone ${MOSCOW_TIME_ZONE})::date`;
    return db.execute<{ id: number; name: string; day: string }>(sql`
    with days as (
      select ${today} + offset_days as occasion from generate_series(0,6) as offsets(offset_days)
    )
    select ${contacts.id} as id, ${contacts.name} as name, to_char(occasion,'YYYY-MM-DD') as day
    from ${contacts} join days on
      ${contacts.birthMonth} = extract(month from occasion)
      and (${contacts.birthDay} = extract(day from occasion)
        or (${contacts.birthDay} = 29 and ${contacts.birthMonth} = 2
          and extract(day from occasion) = 28 and extract(month from occasion + 1) = 3))
    where ${ownContact(ownerId)} and ${contacts.deletedAt} is null
      and (${contacts.birthYear} is null or ${contacts.birthYear} <= extract(year from occasion))
    order by occasion, ${nameInAlphabeticalOrder}, ${contacts.id}
  `);
  },
);

// --- Keep in touch ---
//
// The card and the "Пора связаться" block count the deadline with the same
// SQL, so they never disagree. Days are Moscow calendar days. Day values
// leave the database as 'YYYY-MM-DD' text: a JS Date would shift them
// to the time zone of the server.

const keepInTouchPeriod = sql`case ${contacts.keepInTouchEvery}
  when 'week' then interval '7 days'
  when 'month' then interval '1 month'
  when 'quarter' then interval '3 months'
  when 'year' then interval '1 year'
end`;

// Deleted notes waiting for "Вернуть" do not count.
const lastNoteAt = sql`(
  select max(${notes.createdAt}) from ${notes}
  where ${notes.contactId} = ${contacts.id} and ${notes.deletedAt} is null
)`;

function moscowDay(timestamp: SQL): SQL {
  return sql`(${timestamp} at time zone ${MOSCOW_TIME_ZONE})::date`;
}

// Without notes the deadline counts from the moment the interval was chosen.
// Adding months to a date keeps to the calendar: 31 January + 1 month is
// 28 February.
const dueDay = sql`(${moscowDay(sql`coalesce(${lastNoteAt}, ${contacts.keepInTouchSince})`)} + ${keepInTouchPeriod})::date`;

// Positive once the deadline day is over.
const overdueDays = sql`(${moscowDay(sql`now()`)} - ${dueDay})`;

export type KeepInTouchDue = {
  dueDay: string;
  overdueDays: number;
};

export const getKeepInTouchDue = safeQuery(
  "getKeepInTouchDue",
  async (
    ownerId: string,
    contactId: number,
  ): Promise<KeepInTouchDue | undefined> => {
    const rows = await db
      .select({
        dueDay: sql<string>`${dueDay}::text`,
        overdueDays: sql<number>`${overdueDays}`.mapWith(Number),
      })
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, contactId),
          isNull(contacts.deletedAt),
          isNotNull(contacts.keepInTouchEvery),
        ),
      )
      .limit(1);

    return rows[0];
  },
);

export type OverdueContact = {
  id: number;
  name: string;
  every: KeepInTouchInterval;
  // Moscow day of the latest note; null when there are no notes.
  lastNoteDay: string | null;
  overdueDays: number;
};

// Most overdue first; equal ones in the order of the contact list.
export const listOverdueContacts = safeQuery(
  "listOverdueContacts",
  async (ownerId: string): Promise<OverdueContact[]> => {
    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        every: contacts.keepInTouchEvery,
        lastNoteDay: sql<string | null>`${moscowDay(lastNoteAt)}::text`,
        overdueDays: sql<number>`${overdueDays}`.mapWith(Number),
      })
      .from(contacts)
      .where(
        and(
          ownContact(ownerId),
          isNull(contacts.deletedAt),
          isNotNull(contacts.keepInTouchEvery),
          sql`${overdueDays} > 0`,
        ),
      )
      .orderBy(
        sql`${overdueDays} desc`,
        nameInAlphabeticalOrder,
        asc(contacts.id),
      );

    return rows.map((row) => ({
      ...row,
      every: row.every as KeepInTouchInterval,
    }));
  },
);

// Choosing a different interval restarts the count for a contact without
// notes; choosing the same one again does not. `updatedAt` stays as it is:
// it guards the edit form against changes from another tab, and the form
// does not hold the interval.
export const setKeepInTouch = safeQuery(
  "setKeepInTouch",
  async (ownerId: string, id: number, every: KeepInTouchInterval | null) => {
    const rows = await db
      .update(contacts)
      .set({
        keepInTouchEvery: every,
        keepInTouchSince:
          every === null
            ? null
            : sql`case
              when ${contacts.keepInTouchEvery} = ${every}::keep_in_touch_interval
                and ${contacts.keepInTouchSince} is not null
              then ${contacts.keepInTouchSince}
              else now()
            end`,
      })
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id });

    return rows[0];
  },
);

// Only into a contact of the owner that is not deleted: the note is added
// by the same statement that finds the contact.
export const addNote = safeQuery(
  "addNote",
  async (
    ownerId: string,
    contactId: number,
    body: string,
  ): Promise<{ id: number } | undefined> => {
    const rows = await db.execute<{ id: number }>(sql`
      insert into ${notes} (contact_id, body)
      select ${contacts.id}, ${body} from ${contacts}
      where ${and(
        ownContact(ownerId),
        eq(contacts.id, contactId),
        isNull(contacts.deletedAt),
      )}
      returning id
    `);

    return rows[0];
  },
);

// "Связались" in the "Пора связаться" block is an ordinary note with this
// text, so the deadline restarts like after any other note.
const CONTACTED_NOTE = "Связались";

export const addContactedNote = safeQuery(
  "addContactedNote",
  async (ownerId: string, contactId: number) => {
    return addNote(ownerId, contactId, CONTACTED_NOTE);
  },
);

// "Отменить" right after "Связались" erases that note at once: it is ten
// seconds old and has no "Вернуть" of its own. The text check keeps a stray
// id from erasing an ordinary note.
export const eraseContactedNote = safeQuery(
  "eraseContactedNote",
  async (ownerId: string, id: number) => {
    const rows = await db
      .delete(notes)
      .where(
        and(
          ownNote(ownerId),
          eq(notes.id, id),
          eq(notes.body, CONTACTED_NOTE),
          isNull(notes.deletedAt),
        ),
      )
      .returning({ id: notes.id });

    return rows[0];
  },
);

// Deleting only marks a row (`deletedAt`). The row is erased when the
// "Вернуть" toast closes. If the tab was closed before that, the row is
// erased by a later deletion: the toast timer pauses while the tab is hidden,
// so an hour leaves plenty of room for a toast that is still open.
const ERASE_DELETED_AFTER = sql`interval '1 hour'`;

async function eraseExpiredDeletions(ownerId: string) {
  const expired = sql`now() - ${ERASE_DELETED_AFTER}`;

  // Only the rows of this user: a request never touches anybody else's rows,
  // not even deleted ones.
  await db
    .delete(notes)
    .where(and(ownNote(ownerId), lt(notes.deletedAt, expired)));
  // Notes of an erased contact go with it (on delete cascade).
  await db
    .delete(contacts)
    .where(and(ownContact(ownerId), lt(contacts.deletedAt, expired)));
}

export const deleteContact = safeQuery(
  "deleteContact",
  async (ownerId: string, id: number) => {
    await eraseExpiredDeletions(ownerId);

    const rows = await db
      .update(contacts)
      .set({ deletedAt: sql`now()` })
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id, name: contacts.name });

    return rows[0];
  },
);

export const restoreContact = safeQuery(
  "restoreContact",
  async (ownerId: string, id: number) => {
    const rows = await db
      .update(contacts)
      .set({ deletedAt: null })
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNotNull(contacts.deletedAt),
        ),
      )
      .returning({ id: contacts.id, name: contacts.name });

    return rows[0];
  },
);

// Only a contact marked as deleted can be erased, so a stray call
// cannot wipe out a contact that is in use.
export const eraseDeletedContact = safeQuery(
  "eraseDeletedContact",
  async (ownerId: string, id: number) => {
    await db
      .delete(contacts)
      .where(
        and(
          ownContact(ownerId),
          eq(contacts.id, id),
          isNotNull(contacts.deletedAt),
        ),
      );
  },
);

export const deleteNote = safeQuery(
  "deleteNote",
  async (ownerId: string, id: number) => {
    await eraseExpiredDeletions(ownerId);

    const rows = await db
      .update(notes)
      .set({ deletedAt: sql`now()` })
      .where(and(ownNote(ownerId), eq(notes.id, id), isNull(notes.deletedAt)))
      .returning({ id: notes.id });

    return rows[0];
  },
);

export const restoreNote = safeQuery(
  "restoreNote",
  async (ownerId: string, id: number) => {
    const rows = await db
      .update(notes)
      .set({ deletedAt: null })
      .where(
        and(ownNote(ownerId), eq(notes.id, id), isNotNull(notes.deletedAt)),
      )
      .returning({ id: notes.id });

    return rows[0];
  },
);

export const eraseDeletedNote = safeQuery(
  "eraseDeletedNote",
  async (ownerId: string, id: number) => {
    await db
      .delete(notes)
      .where(
        and(ownNote(ownerId), eq(notes.id, id), isNotNull(notes.deletedAt)),
      );
  },
);

// --- Groups ---

// The same key as the unique index on groups: capital letters and "ё"/"е" do
// not make two names different.
function groupNameKey(name: SQLWrapper): SQL {
  return sql`replace(lower(${name}), 'ё', 'е')`;
}

export type GroupListItem = {
  id: number;
  name: string;
  // Contacts that are not waiting for "Вернуть".
  contactCount: number;
};

// By alphabet, like the contact list; an empty group has a count of 0.
export const listGroups = safeQuery(
  "listGroups",
  async (ownerId: string): Promise<GroupListItem[]> => {
    return db
      .select({
        id: groups.id,
        name: groups.name,
        contactCount: count(contacts.id),
      })
      .from(groups)
      .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
      .leftJoin(
        contacts,
        and(
          eq(contacts.id, contactGroups.contactId),
          ownContact(ownerId),
          isNull(contacts.deletedAt),
        ),
      )
      .where(ownGroup(ownerId))
      .groupBy(groups.id)
      .orderBy(sql`${groups.name} collate "ru-x-icu"`, asc(groups.id));
  },
);

export type GroupRef = { id: number; name: string };

// Makes the group, or finds the one of this user that already has this name.
// Another user's group with the same name is not in the way. Two tabs can
// make the same name at once: the unique index lets one of them in, and the
// other gets the group that won.
export const createGroup = safeQuery(
  "createGroup",
  async (
    ownerId: string,
    name: string,
  ): Promise<{ group: GroupRef; created: boolean }> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const inserted = await db
        .insert(groups)
        .values({ ownerId, name })
        .onConflictDoNothing()
        .returning({ id: groups.id, name: groups.name });

      if (inserted[0]) {
        return { group: inserted[0], created: true };
      }

      const existing = await db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(
          and(
            ownGroup(ownerId),
            sql`${groupNameKey(groups.name)} = ${groupNameKey(sql`${name}`)}`,
          ),
        )
        .limit(1);

      if (existing[0]) {
        return { group: existing[0], created: false };
      }

      // The group that blocked the insert was deleted in between: try again.
    }

    throw new Error("createGroup failed: the group keeps changing");
  },
);

export type SetContactGroupResult =
  "ok" | "contact_not_found" | "group_not_found";

// Puts one contact into one group, or takes it out. One pair at a time, so a
// tick in this tab never overwrites a tick made in another one. Adding twice
// and removing twice are both fine. `updatedAt` of the contact stays as it is:
// it guards the "Изменить" form, and the form does not hold groups.
export const setContactGroup = safeQuery(
  "setContactGroup",
  async (
    ownerId: string,
    contactId: number,
    groupId: number,
    member: boolean,
  ): Promise<SetContactGroupResult> => {
    const [contact, group] = await Promise.all([
      db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            ownContact(ownerId),
            eq(contacts.id, contactId),
            isNull(contacts.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: groups.id })
        .from(groups)
        .where(and(ownGroup(ownerId), eq(groups.id, groupId)))
        .limit(1),
    ]);

    if (!contact[0]) {
      return "contact_not_found";
    }

    if (!group[0]) {
      return "group_not_found";
    }

    if (member) {
      await db
        .insert(contactGroups)
        .values({ contactId, groupId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(contactGroups)
        .where(
          and(
            eq(contactGroups.contactId, contactId),
            eq(contactGroups.groupId, groupId),
          ),
        );
    }

    return "ok";
  },
);

// The groups of one contact, by alphabet.
export const listContactGroups = safeQuery(
  "listContactGroups",
  async (ownerId: string, contactId: number): Promise<GroupRef[]> => {
    return db
      .select({ id: groups.id, name: groups.name })
      .from(contactGroups)
      .innerJoin(groups, eq(groups.id, contactGroups.groupId))
      .where(and(ownGroup(ownerId), eq(contactGroups.contactId, contactId)))
      .orderBy(sql`${groups.name} collate "ru-x-icu"`, asc(groups.id));
  },
);

export const findGroup = safeQuery(
  "findGroup",
  async (ownerId: string, id: number): Promise<GroupRef | undefined> => {
    const rows = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(ownGroup(ownerId), eq(groups.id, id)))
      .limit(1);

    return rows[0];
  },
);

export type RenameGroupResult =
  | { status: "renamed"; group: GroupRef }
  | { status: "not_found" }
  // Another group already has this name.
  | { status: "taken"; group: GroupRef };

// A group may take the name it has now, or the same name in other letters
// ("теннис" -> "Теннис"): only another group of the same user with the same
// name is in the way.
export const renameGroup = safeQuery(
  "renameGroup",
  async (
    ownerId: string,
    id: number,
    name: string,
  ): Promise<RenameGroupResult> => {
    const other = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(
        and(
          ownGroup(ownerId),
          sql`${groups.id} <> ${id}`,
          sql`${groupNameKey(groups.name)} = ${groupNameKey(sql`${name}`)}`,
        ),
      )
      .limit(1);

    if (other[0]) {
      return { status: "taken", group: other[0] };
    }

    const rows = await db
      .update(groups)
      .set({ name })
      .where(and(ownGroup(ownerId), eq(groups.id, id)))
      .returning({ id: groups.id, name: groups.name });

    return rows[0]
      ? { status: "renamed", group: rows[0] }
      : { status: "not_found" };
  },
);

// The rows of `contact_groups` go with the group (on delete cascade); the
// contacts stay.
export const deleteGroup = safeQuery(
  "deleteGroup",
  async (ownerId: string, id: number): Promise<GroupRef | undefined> => {
    const rows = await db
      .delete(groups)
      .where(and(ownGroup(ownerId), eq(groups.id, id)))
      .returning({ id: groups.id, name: groups.name });

    return rows[0];
  },
);
