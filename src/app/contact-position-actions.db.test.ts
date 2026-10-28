import { describe, expect, it } from "vitest";

import { createContactAction, restoreContactAction } from "@/app/actions";

import {
  createTestContacts,
  formOf,
  markContactDeleted,
} from "../../test/factories";

// "Человек 001" … "Человек 250", so a new "Ярослава Юдина" stands last.
async function addPeople(count: number): Promise<number[]> {
  return createTestContacts(
    Array.from({ length: count }, (_, index) => ({
      name: `Человек ${String(index + 1).padStart(3, "0")}`,
    })),
  );
}

describe("the place of a contact after an action", () => {
  it("is told for a new contact [Добавила контакт дальше показанных]", async () => {
    await addPeople(250);

    const result = await createContactAction(
      formOf({ name: "Ярослава Юдина" }),
    );

    expect(result.ok && result.data.position).toBe(251);
  });

  it("is told for a contact brought back by «Вернуть» [Вернула удалённый контакт]", async () => {
    const ids = await addPeople(250);
    await markContactDeleted(ids[239]);

    const result = await restoreContactAction(ids[239]);

    expect(result.ok && result.data.position).toBe(240);
  });
});
