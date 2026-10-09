const numberFormat = new Intl.NumberFormat("ru-RU");

const noteDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

// Russian has three plural forms: 1 контакт, 2 контакта, 5 контактов.
export function pluralize(
  count: number,
  forms: readonly [one: string, few: string, many: string],
): string {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return forms[2];
  }

  if (last === 1) {
    return forms[0];
  }

  if (last >= 2 && last <= 4) {
    return forms[1];
  }

  return forms[2];
}

export function formatNoteDate(date: Date): string {
  return noteDateFormat.format(date);
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");

  return letters.join("").toUpperCase() || "?";
}

// The first letter of the name, used to group the alphabetical list.
export function getGroupLetter(name: string): string {
  const first = [...name.trim()][0]?.toUpperCase() ?? "";

  // The list is sorted with "ё" next to "е", so they share one group.
  if (first === "Ё") {
    return "Е";
  }

  return /\p{L}/u.test(first) ? first : "#";
}

const AVATAR_HUES = [25, 55, 90, 145, 185, 230, 280, 335] as const;

// The same name always gets the same colour.
export function getAvatarHue(name: string): number {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }

  return AVATAR_HUES[hash % AVATAR_HUES.length];
}

export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
