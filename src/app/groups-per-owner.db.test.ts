// openspec/specs/contact-groups, «Название группы проверяется»:
// two groups with one name cannot be in one user's book, but two users may
// each have their own. A's groups are made first, so a lookup that forgets
// the owner finds A's group before B's.

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createGroupAction,
  createGroupForContactAction,
  renameGroupAction,
} from "@/app/actions";
import { db } from "@/db";
import { listContactGroups, listGroups } from "@/db/queries";
import { contactGroups } from "@/db/schema";

import {
  createTestContact,
  createTestGroup,
  formOf,
  signInAs,
  USER_A,
  USER_B,
} from "../../test/factories";

async function membersOf(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ contactId: contactGroups.contactId })
    .from(contactGroups)
    .where(eq(contactGroups.groupId, groupId));

  return rows.map((row) => row.contactId);
}

describe("the same name in two books", () => {
  it("B makes «Друзья» while A has «Друзья» [Такое же название у другого пользователя]", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    const friendsOfA = await createTestGroup("Друзья", USER_A);
    await db
      .insert(contactGroups)
      .values({ contactId: anna, groupId: friendsOfA });

    signInAs(USER_B);
    const result = await createGroupAction(formOf({ name: "Друзья" }));

    expect(result.ok).toBe(true);
    expect(await listGroups(USER_B)).toEqual([
      { id: expect.any(Number), name: "Друзья", contactCount: 0 },
    ]);
    expect(await listGroups(USER_A)).toEqual([
      { id: friendsOfA, name: "Друзья", contactCount: 1 },
    ]);
  });

  it("B's own group of that name is what is taken, not A's [Такое же название у другого пользователя]", async () => {
    await createTestGroup("Друзья", USER_A);
    await createTestGroup("друзья", USER_B);

    signInAs(USER_B);

    expect(await createGroupAction(formOf({ name: "ДРУЗЬЯ" }))).toEqual({
      ok: false,
      errors: { name: "Группа «друзья» уже есть" },
    });
  });

  it("B renames a group to the name of A's group [Такое же название у другого пользователя]", async () => {
    await createTestGroup("Друзья", USER_A);
    const tennis = await createTestGroup("Теннис", USER_B);

    signInAs(USER_B);
    const result = await renameGroupAction(tennis, formOf({ name: "Друзья" }));

    expect(result).toEqual({
      ok: true,
      data: { id: tennis, name: "Друзья" },
    });
  });

  it("the card puts B's contact into B's own group [Название из карточки совпало с чужой группой]", async () => {
    const anna = await createTestContact("Анна Смирнова", USER_A);
    const friendsOfA = await createTestGroup("Друзья", USER_A);
    await db
      .insert(contactGroups)
      .values({ contactId: anna, groupId: friendsOfA });
    const gleb = await createTestContact("Глеб Орлов", USER_B);

    signInAs(USER_B);
    const first = await createGroupForContactAction(
      gleb,
      formOf({ name: "Друзья" }),
    );

    expect(first.ok).toBe(true);
    expect(await listContactGroups(USER_B, gleb)).toEqual([
      { id: expect.any(Number), name: "Друзья" },
    ]);
    expect(await membersOf(friendsOfA)).toEqual([anna]);
  });

  it("the card finds B's own group when B has one already [Название из карточки совпало с чужой группой]", async () => {
    await createTestGroup("Друзья", USER_A);
    const friendsOfB = await createTestGroup("друзья", USER_B);
    const gleb = await createTestContact("Глеб Орлов", USER_B);

    signInAs(USER_B);
    const result = await createGroupForContactAction(
      gleb,
      formOf({ name: "Друзья" }),
    );

    expect(result).toEqual({
      ok: true,
      data: { id: friendsOfB, name: "друзья" },
    });
    expect(await membersOf(friendsOfB)).toEqual([gleb]);
  });
});
