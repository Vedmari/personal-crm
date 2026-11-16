import { describe, expect, it } from "vitest";

import { buildLoginEmail } from "./login-email";

// A sign-in link carries several parameters, joined with "&".
const URL =
  "https://app.lichnaya-crm.ru/api/auth/magic-link/verify?token=abc&callbackURL=%2F";

describe("buildLoginEmail", () => {
  const email = buildLoginEmail(URL);

  it("has the subject of the sign-in email [Что в письме]", () => {
    expect(email.subject).toBe("Вход в Личную CRM");
  });

  it("has a «Войти» button that leads to the link [Что в письме]", () => {
    const button = /<a\b[^>]*\bhref="([^"]*)"[^>]*>\s*Войти\s*<\/a>/.exec(
      email.html,
    );

    expect(button).not.toBeNull();
    // In HTML "&" is written as "&amp;"; the mail program reads it back.
    expect(button![1].replaceAll("&amp;", "&")).toBe(URL);
  });

  it("says the link works 15 minutes and what to do if it was not you [Что в письме]", () => {
    for (const body of [email.html, email.text]) {
      expect(body).toContain("15 минут");
      expect(body).toContain(
        "Если вы не запрашивали вход — просто проигнорируйте письмо",
      );
    }
  });

  it("has a text version with the link [Что в письме]", () => {
    expect(email.text).toContain(URL);
    expect(email.text).not.toContain("<");
  });

  it("has no pictures and no outside styles", () => {
    expect(email.html).not.toMatch(/<img|<link|url\(/i);
  });
});
