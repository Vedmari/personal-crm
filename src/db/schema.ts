import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- Users and sign-in (Better Auth) ---
//
// The tables Better Auth works with, in the shape of Better Auth 1.7: field
// keys in camelCase, columns in snake_case like the other tables. Ids are
// text made by Better Auth. A sign-in by link does not use `account`, but
// Better Auth expects the table to be there.

export const user = pgTable("user", {
  id: text().primaryKey(),
  // Not asked for: a sign-in by link leaves it empty.
  name: text().notNull(),
  // In one spelling: lower case, no spaces at the ends (normalizeEmail).
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per signed-in device. "Выйти" deletes the row of this device only.
export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

// Sign-in links that wait to be opened: identifier "magic-link:<key>", the
// email in the JSON of `value`. Opening a link deletes its row.
export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Sign-in emails sent lately, for the limit of 3 per email in 10 minutes.
// Rows older than that are deleted by the next request for the same email.
export const loginLinkSends = pgTable(
  "login_link_sends",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("login_link_sends_email_created_at_idx").on(
      table.email,
      table.createdAt,
    ),
  ],
);

// --- Contacts, notes and groups ---
//
// Every contact and every group belongs to a user (owner_id), who alone sees
// and changes it. A note belongs to the owner of its contact. A user who owns
// data cannot be deleted: there is no account deletion, and a stray delete
// must not take the contacts along.

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
export const contacts = pgTable(
  "contacts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
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
  },
  (table) => [index("contacts_owner_id_idx").on(table.ownerId)],
);

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

// Groups are made by the user ("Семья", "Теннис"). The unique index keeps one
// user from having two groups with the same name: capital letters and "ё"/"е"
// do not count as a difference, as in search, so "ЁЛКА" and "елка" are the
// same name. Two users may each have a group "Друзья" of their own.
export const groups = pgTable(
  "groups",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_owner_id_name_unique_idx").on(
      table.ownerId,
      sql`replace(lower(${table.name}), 'ё', 'е')`,
    ),
  ],
);

// Who is in which group. A contact can be in many groups. Deleting a group
// removes its rows here; erasing a contact removes its rows. A contact that
// is only marked as deleted keeps them, so "Вернуть" puts it back in its groups.
// A contact and a group of one row always have the same owner: the queries
// check both ends before they add a row.
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
export type User = typeof user.$inferSelect;
