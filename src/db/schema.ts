import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// How often to keep in touch with a contact. Not a free-text field, so the
// database accepts only these values; NULL in the contact means "not set".
export const keepInTouchInterval = pgEnum("keep_in_touch_interval", [
  "week",
  "month",
  "quarter",
  "year",
]);

// Optional text fields are stored as empty strings instead of NULL,
// so the UI never has to tell "missing" from "empty".
export const contacts = pgTable("contacts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  // Who this person is: role, relation, anything that identifies them.
  about: text().notNull().default(""),
  howWeMet: text("how_we_met").notNull().default(""),
  phone: text().notNull().default(""),
  email: text().notNull().default(""),
  // What we agreed on with this person.
  agreements: text().notNull().default(""),
  keepInTouchEvery: keepInTouchInterval("keep_in_touch_every"),
  // When the current interval was chosen. A contact without notes counts
  // its keep-in-touch deadline from here.
  keepInTouchSince: timestamp("keep_in_touch_since", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Set when the contact is deleted. The row stays while "Вернуть" can still
  // bring it back, and is erased after that.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const notes = pgTable(
  "notes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Same as contacts.deletedAt.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("notes_contact_id_created_at_idx").on(
      table.contactId,
      table.createdAt,
    ),
  ],
);

// Groups are made by the user ("Семья", "Теннис"). The unique index keeps two
// groups from having the same name: capital letters and "ё"/"е" do not count
// as a difference, as in search, so "ЁЛКА" and "елка" are the same name.
export const groups = pgTable(
  "groups",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_name_unique_idx").on(
      sql`replace(lower(${table.name}), 'ё', 'е')`,
    ),
  ],
);

// Who is in which group. A contact can be in many groups. Deleting a group
// removes its rows here; erasing a contact removes its rows. A contact that
// is only marked as deleted keeps them, so "Вернуть" puts it back in its groups.
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type KeepInTouchInterval =
  (typeof keepInTouchInterval.enumValues)[number];
export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
