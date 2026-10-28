import { describe, expect, it } from "vitest";

import {
  listHref,
  parseListParams,
  parseShown,
  showsKeepInTouch,
  shownFor,
} from "./list-filter";

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

describe("listHref with the length of the list", () => {
  it("holds a longer list in the address", () => {
    expect(listHref({ shown: 200 })).toBe("/?shown=200");
    expect(listHref({ q: "анна", group: 5, shown: 300 })).toBe(
      `/?q=${encoded("анна")}&group=5&shown=300`,
    );
  });

  it("leaves the first hundred out of the address", () => {
    expect(listHref({ shown: 100 })).toBe("/");
    expect(listHref({ q: "анна", shown: 100 })).toBe(`/?q=${encoded("анна")}`);
  });

  it("starts from the first hundred when the search or the group changes [Новый запрос начинает сначала]", () => {
    // The search box and the group buttons make their links without `shown`.
    expect(listHref({ q: "овна" })).toBe(`/?q=${encoded("овна")}`);
    expect(listHref({ group: 5 })).toBe("/?group=5");
  });
});

describe("parseShown", () => {
  it("is the first hundred when the address says nothing", () => {
    expect(parseShown({})).toBe(100);
  });

  it("is the first hundred for a wrong number [Неверное число в адресе]", () => {
    for (const shown of ["abc", "0", "-5", "1e9", "1.5", ""]) {
      expect(parseShown({ shown })).toBe(100);
    }
  });

  it("is the first hundred when given twice", () => {
    expect(parseShown({ shown: ["200", "300"] })).toBe(100);
  });

  it("rounds up to whole hundreds", () => {
    expect(parseShown({ shown: "150" })).toBe(200);
    expect(parseShown({ shown: "200" })).toBe(200);
    expect(parseShown({ shown: "1" })).toBe(100);
  });

  it("reads back what listHref wrote", () => {
    const query = Object.fromEntries(
      new URL(listHref({ q: "анна", shown: 300 }), "http://localhost")
        .searchParams,
    );

    expect(parseShown(query)).toBe(300);
  });
});

describe("shownFor", () => {
  it("is the length of the list that reaches the contact at a position", () => {
    expect(shownFor(1)).toBe(100);
    expect(shownFor(100)).toBe(100);
    expect(shownFor(101)).toBe(200);
    expect(shownFor(251)).toBe(300);
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

  it("shows the block on the plain list", () => {
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

    expect(showsKeepInTouch({ search: afterAll.search, group: null })).toBe(
      true,
    );
  });
});
