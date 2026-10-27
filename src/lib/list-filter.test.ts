import { describe, expect, it } from "vitest";

import { listHref, parseListParams, showsKeepInTouch } from "./list-filter";

const encoded = (text: string) => encodeURIComponent(text);

describe("listHref", () => {
  it("is the plain list when nothing is chosen", () => {
    expect(listHref({})).toBe("/");
    expect(listHref({ q: "", group: null })).toBe("/");
  });

  it("holds the group in the address [Ссылка с выбранной группой]", () => {
    expect(listHref({ group: 5 })).toBe("/?group=5");
  });

  it("keeps the search when a group is chosen [Выбор группы во время поиска]", () => {
    expect(listHref({ q: "анна", group: 5 })).toBe(
      `/?q=${encoded("анна")}&group=5`,
    );
  });

  it("keeps the group when the search changes [Поиск внутри группы]", () => {
    expect(listHref({ q: "петров", group: 12 })).toBe(
      `/?q=${encoded("петров")}&group=12`,
    );
  });

  it("drops the group and keeps the search for «Все» [Вернуться ко всем]", () => {
    expect(listHref({ q: "анна", group: null })).toBe(`/?q=${encoded("анна")}`);
    expect(listHref({ q: "анна" })).toBe(`/?q=${encoded("анна")}`);
  });

  it("is the link from a card or from the page «Группы» [Из карточки — в фильтр группы] [Со страницы — в фильтр группы]", () => {
    expect(listHref({ group: 3 })).toBe("/?group=3");
  });

  it("drops a search of spaces only", () => {
    expect(listHref({ q: "   ", group: 5 })).toBe("/?group=5");
  });

  it("encodes characters that would break the address", () => {
    const href = listHref({ q: "а&б=в #", group: 1 });

    expect(href).toBe(`/?q=${encoded("а&б=в #")}&group=1`);
    expect(new URL(href, "http://localhost").searchParams.get("q")).toBe(
      "а&б=в #",
    );
  });
});

describe("parseListParams", () => {
  it("reads the search and the group", () => {
    expect(parseListParams({ q: "анна", group: "5" })).toEqual({
      search: "анна",
      groupId: 5,
    });
  });

  it("is empty when the address has no parameters", () => {
    expect(parseListParams({})).toEqual({ search: "", groupId: null });
  });

  it("cuts spaces from the search", () => {
    expect(parseListParams({ q: "  анна " }).search).toBe("анна");
  });

  it("ignores a group that is not an id [Группы из адреса больше нет]", () => {
    for (const group of ["abc", "0", "-1", "1.5", "5; drop table groups", ""]) {
      expect(parseListParams({ group }).groupId).toBeNull();
    }
  });

  it("ignores a parameter that was given twice", () => {
    expect(parseListParams({ q: ["а", "б"], group: ["1", "2"] })).toEqual({
      search: "",
      groupId: null,
    });
  });

  it("reads back what listHref wrote", () => {
    for (const params of [
      { q: "анна", group: 5 },
      { q: "а&б=в #", group: 12 },
      { q: "", group: 7 },
      { q: "петров", group: null },
    ]) {
      const query = Object.fromEntries(
        new URL(listHref(params), "http://localhost").searchParams,
      );

      expect(parseListParams(query)).toEqual({
        search: params.q,
        groupId: params.group,
      });
    }
  });
});

describe("showsKeepInTouch", () => {
  const group = { id: 5, name: "Теннис" };

  it("shows the block on the plain list [Никто не просрочен]", () => {
    expect(showsKeepInTouch({ search: "", group: null })).toBe(true);
  });

  it("hides the block while searching [Идёт поиск]", () => {
    expect(showsKeepInTouch({ search: "анна", group: null })).toBe(false);
  });

  it("hides the block while a group is chosen [Выбрана группа]", () => {
    expect(showsKeepInTouch({ search: "", group })).toBe(false);
  });

  it("hides the block when both are set", () => {
    expect(showsKeepInTouch({ search: "анна", group })).toBe(false);
  });

  it("brings the block back after «Все» and a cleared search [Выбрана группа]", () => {
    const afterAll = parseListParams({});

    expect(showsKeepInTouch({ search: afterAll.search, group: null })).toBe(true);
  });
});
