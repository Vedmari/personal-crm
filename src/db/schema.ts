import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
