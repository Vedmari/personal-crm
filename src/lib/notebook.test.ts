import { describe, expect, it } from "vitest";

import {
  coverScript,
  readBookmark,
  shouldShowCover,
  withoutLandingMark,
} from "./notebook";

describe("shouldShowCover", () => {
  it("shows the cover the first time in a session [Первое открытие за сеанс]", () => {
    expect(shouldShowCover({ cookie: "", search: "" })).toBe(true);
    expect(shouldShowCover({ cookie: "theme=dark", search: "?q=анна" })).toBe(
      true,
    );
  });

  it("hides the cover once it was opened [Повторное открытие в том же сеансе]", () => {
    expect(shouldShowCover({ cookie: "notebook-opened=1", search: "" })).toBe(
      false,
    );
    expect(
      shouldShowCover({
        cookie: "theme=dark; notebook-opened=1",
        search: "?shown=200",
      }),
    ).toBe(false);
  });

  it("shows the cover again after the landing [Переход с лендинга]", () => {
    expect(
      shouldShowCover({ cookie: "notebook-opened=1", search: "?from=landing" }),
    ).toBe(true);
    expect(
      shouldShowCover({
        cookie: "notebook-opened=1",
        search: "?q=анна&from=landing",
      }),
    ).toBe(true);
  });

  it("does not take a look-alike cookie or mark for its own", () => {
    expect(shouldShowCover({ cookie: "notebook-opened-x=1", search: "" })).toBe(
      true,
    );
    expect(
      shouldShowCover({ cookie: "notebook-opened=1", search: "?from=mail" }),
    ).toBe(false);
  });
});

describe("withoutLandingMark", () => {
  it("drops only the landing mark", () => {
    expect(withoutLandingMark("?from=landing")).toBe("");
    expect(withoutLandingMark("?q=%D0%B0&from=landing&shown=200")).toBe(
      "?q=%D0%B0&shown=200",
    );
    expect(withoutLandingMark("?from=mail")).toBe("?from=mail");
    expect(withoutLandingMark("")).toBe("");
  });
});

describe("coverScript", () => {
  // Runs the script the way the browser does, on a stand-in document.
  function run(cookie: string, search: string) {
    const attributes = new Map<string, string>();
    const document = {
      cookie,
      documentElement: {
        setAttribute: (name: string, value: string) =>
          attributes.set(name, value),
      },
    };

    new Function("document", "location", coverScript())(document, { search });

    return { cover: attributes.get("data-cover"), cookie: document.cookie };
  }

  it("closes the cover and remembers it for the session", () => {
    expect(run("", "")).toEqual({
      cover: "closed",
      cookie: "notebook-opened=1; path=/; SameSite=Lax",
    });
  });

  it("leaves the page alone once the cover was opened", () => {
    expect(run("notebook-opened=1", "").cover).toBeUndefined();
  });
});

describe("readBookmark", () => {
  it("reads a saved bookmark", () => {
    expect(readBookmark('{"id":12,"name":"Анна Петрова"}')).toEqual({
      id: 12,
      name: "Анна Петрова",
    });
  });

  it("ignores anything that is not a bookmark", () => {
    for (const raw of [
      null,
      "",
      "{",
      "[]",
      '{"id":12}',
      '{"id":"12","name":"Анна"}',
      '{"id":0,"name":"Анна"}',
      '{"id":1.5,"name":"Анна"}',
      '{"id":12,"name":""}',
    ]) {
      expect(readBookmark(raw)).toBeNull();
    }
  });
});
