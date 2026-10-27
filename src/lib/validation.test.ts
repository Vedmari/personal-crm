import { describe, expect, it } from "vitest";

import { GROUP_NAME_MAX_LENGTH, parseGroupName } from "./validation";

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
