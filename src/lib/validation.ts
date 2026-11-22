import type { KeepInTouchInterval } from "@/db/schema";

type ContactText = {
  name: string;
  about: string;
  howWeMet: string;
  phone: string;
  email: string;
  agreements: string;
};

export const BIRTH_FIELDS = ["birthDay", "birthMonth", "birthYear"] as const;
export type BirthField = (typeof BIRTH_FIELDS)[number];
export type ContactInput = ContactText &
  Partial<Record<BirthField, number | null>>;
export type ContactField = keyof ContactInput;

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type ParseResult<Data, Field extends string> =
  { ok: true; data: Data } | { ok: false; errors: FieldErrors<Field> };

export const CONTACT_LIMITS: Record<keyof ContactText, number> = {
  name: 200,
  about: 300,
  howWeMet: 500,
  phone: 50,
  email: 254,
  agreements: 5000,
};

export const NOTE_MAX_LENGTH = 10000;

const CONTACT_FIELDS = Object.keys(CONTACT_LIMITS) as (keyof ContactText)[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function parseBirthday(
  form: FormData,
): ParseResult<Partial<Record<BirthField, number | null>>, BirthField> {
  // An older form omits all three keys. Preserve any birthday saved since.
  if (!BIRTH_FIELDS.some((field) => form.has(field)))
    return { ok: true, data: {} };
  const parts = { birthDay: null, birthMonth: null, birthYear: null } as Record<
    BirthField,
    number | null
  >;
  for (const field of BIRTH_FIELDS) {
    const value = form.get(field);
    if (value === null || value === "") continue;
    if (
      typeof value !== "string" ||
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    ) {
      return { ok: false, errors: { [field]: "Введите целое число" } };
    }
    parts[field] = Number(value);
  }
  const { birthDay: day, birthMonth: month, birthYear: year } = parts;
  if (day === null && month === null && year === null)
    return { ok: true, data: parts };
  if (day === null || month === null)
    return {
      ok: false,
      errors: {
        [day === null ? "birthDay" : "birthMonth"]:
          "Укажите день и месяц рождения",
      },
    };
  if (year !== null && (year < 1 || year > 9999))
    return { ok: false, errors: { birthYear: "Укажите год от 1 до 9999" } };
  if (month < 1 || month > 12)
    return { ok: false, errors: { birthMonth: "Укажите месяц от 1 до 12" } };
  // Use a leap year only to validate a yearless February 29.
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(year ?? 2000, month, 0);
  if (day < 1 || day > lastDay.getUTCDate())
    return {
      ok: false,
      errors: { birthDay: "Такой даты рождения не существует" },
    };
  return { ok: true, data: parts };
}

// Validation messages are shown in the interface, so they are in Russian.
export function parseContactForm(
  formData: FormData,
): ParseResult<ContactInput, ContactField> {
  const data = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [field, readText(formData, field)]),
  ) as ContactText;

  const errors: FieldErrors<ContactField> = {};

  for (const field of CONTACT_FIELDS) {
    if (data[field].length > CONTACT_LIMITS[field]) {
      errors[field] =
        `Слишком длинно: не больше ${CONTACT_LIMITS[field]} символов`;
    }
  }

  if (!data.name) {
    errors.name = "Укажите имя";
  }

  if (data.email && !errors.email && !EMAIL_PATTERN.test(data.email)) {
    errors.email = "Похоже, в адресе почты ошибка";
  }

  const birthday = parseBirthday(formData);
  if (!birthday.ok)
    return { ok: false, errors: { ...errors, ...birthday.errors } };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { ...data, ...birthday.data } };
}

// One spelling of an email: "  Anna@Example.COM " and "anna@example.com" are
// the same person. Used by the sign-in and by scripts/migrate.mts for
// OWNER_EMAIL, so the owner of the old data signs in under any spelling.
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const LOGIN_EMAIL_INVALID = "Проверьте адрес почты";

// The email of the sign-in form, and of any request for a sign-in link: the
// server checks it the same way when the request does not come from the form.
// The format check is the one of the email of a contact.
export function parseLoginEmail(value: unknown): ParseResult<string, "email"> {
  const email = typeof value === "string" ? normalizeEmail(value) : "";

  if (
    !email ||
    email.length > CONTACT_LIMITS.email ||
    !EMAIL_PATTERN.test(email)
  ) {
    return { ok: false, errors: { email: LOGIN_EMAIL_INVALID } };
  }

  return { ok: true, data: email };
}

export function parseNoteForm(formData: FormData): ParseResult<string, "body"> {
  const body = readText(formData, "body");

  if (!body) {
    return { ok: false, errors: { body: "Напишите текст заметки" } };
  }

  if (body.length > NOTE_MAX_LENGTH) {
    return {
      ok: false,
      errors: {
        body: `Слишком длинно: не больше ${NOTE_MAX_LENGTH} символов`,
      },
    };
  }

  return { ok: true, data: body };
}

export const GROUP_NAME_MAX_LENGTH = 50;

// The name of a group, from a form field or an action argument. Spaces at the
// ends are cut. Whether the name is already taken is for the database to say.
export function parseGroupName(value: unknown): ParseResult<string, "name"> {
  const name = typeof value === "string" ? value.trim() : "";

  if (!name) {
    return { ok: false, errors: { name: "Напишите название группы" } };
  }

  if (name.length > GROUP_NAME_MAX_LENGTH) {
    return {
      ok: false,
      errors: {
        name: `Слишком длинно: не больше ${GROUP_NAME_MAX_LENGTH} символов`,
      },
    };
  }

  return { ok: true, data: name };
}

// In the order of the choice in the contact card.
export const KEEP_IN_TOUCH_INTERVALS = [
  "week",
  "month",
  "quarter",
  "year",
] as const satisfies readonly KeepInTouchInterval[];

// The interval chosen in the contact card; null is "Не задано".
// Returns undefined for anything else.
export function parseKeepInTouch(
  value: unknown,
): KeepInTouchInterval | null | undefined {
  if (value === null) {
    return null;
  }

  return KEEP_IN_TOUCH_INTERVALS.find((interval) => interval === value);
}

// Route params and action arguments come from the client, so the id is checked
// before it reaches the database. Returns null for anything that is not an id.
export function parseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);

  if (typeof value === "string" && !/^\d{1,9}$/.test(value)) {
    return null;
  }

  return Number.isInteger(id) && id > 0 && id < 2 ** 31 ? id : null;
}

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// A timestamp travels to the browser and back as text (Date.toISOString).
// Returns null for anything else.
export function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
