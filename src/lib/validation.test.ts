import { describe, expect, it } from "vitest";

import {
  GROUP_NAME_MAX_LENGTH,
  normalizeEmail,
  parseContactForm,
  parseGroupName,
  parseLoginEmail,
} from "./validation";

describe("parseGroupName", () => {
  it("cuts spaces from the ends [Создать группу на странице «Группы»]", () => {
    expect(parseGroupName(" Теннис ")).toEqual({ ok: true, data: "Теннис" });
  });

  it("keeps spaces inside the name", () => {
    expect(parseGroupName("Клуб  по  теннису")).toEqual({
      ok: true,
      data: "Клуб  по  теннису",
    });
  });

  it("refuses an empty name [Пустое название]", () => {
    expect(parseGroupName("")).toEqual({
      ok: false,
      errors: { name: "Напишите название группы" },
    });
  });

  it("refuses a name of spaces only [Пустое название]", () => {
    expect(parseGroupName("   \t ")).toEqual({
      ok: false,
      errors: { name: "Напишите название группы" },
    });
  });

  it.each([undefined, null, 42, new File([], "x")])(
    "refuses a value that is not text: %s [Пустое название]",
    (value) => {
      expect(parseGroupName(value)).toEqual({
        ok: false,
        errors: { name: "Напишите название группы" },
      });
    },
  );

  it("accepts a name of exactly 50 characters", () => {
    const name = "я".repeat(GROUP_NAME_MAX_LENGTH);

    expect(GROUP_NAME_MAX_LENGTH).toBe(50);
    expect(parseGroupName(name)).toEqual({ ok: true, data: name });
  });

  it("refuses a name of 51 characters [Слишком длинное название]", () => {
    expect(parseGroupName("я".repeat(51))).toEqual({
      ok: false,
      errors: { name: "Слишком длинно: не больше 50 символов" },
    });
  });

  it("counts the length after cutting spaces [Слишком длинное название]", () => {
    const name = "я".repeat(GROUP_NAME_MAX_LENGTH);

    expect(parseGroupName(`  ${name}  `)).toEqual({ ok: true, data: name });
  });
});

describe("normalizeEmail", () => {
  it("cuts spaces and lowers the letters [Пробелы и большие буквы]", () => {
    expect(normalizeEmail("  Anna@Example.COM ")).toBe("anna@example.com");
  });
});

describe("parseLoginEmail", () => {
  it("returns the email in one spelling [Пробелы и большие буквы]", () => {
    expect(parseLoginEmail("  Anna@Example.COM ")).toEqual({
      ok: true,
      data: "anna@example.com",
    });
  });

  it("refuses an address without a domain [Ошибка в адресе]", () => {
    expect(parseLoginEmail("anna@")).toEqual({
      ok: false,
      errors: { email: "Проверьте адрес почты" },
    });
  });

  it("refuses an empty field [Ошибка в адресе]", () => {
    for (const value of ["", "   ", null, undefined, 42]) {
      expect(parseLoginEmail(value)).toEqual({
        ok: false,
        errors: { email: "Проверьте адрес почты" },
      });
    }
  });

  it("checks the format the way the email of a contact is checked", () => {
    for (const value of ["anna", "anna@example", "an na@example.com"]) {
      expect(parseLoginEmail(value).ok).toBe(false);
      expect(parseContactForm(formOf({ name: "Анна", email: value })).ok).toBe(
        false,
      );
    }

    expect(parseLoginEmail(`${"a".repeat(250)}@b.ru`).ok).toBe(false);
  });
});

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return form;
}
