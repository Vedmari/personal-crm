// The sign-in email: a «Войти» button that leads to the sign-in link, and a
// text version for mail programs that do not show HTML. No pictures and no
// outside styles: many mail programs block them.
//
// Colors are written in the letter itself: a mail program cannot read the
// design tokens. They are the values of src/styles/tokens.css:
// --color-book-cover, --color-btn-text, --color-paper, --color-ink,
// --color-ink-body and --color-ink-muted.

const COLORS = {
  button: "#3f5a3a",
  buttonText: "#f1ead4",
  paper: "#f1e9d2",
  heading: "#2b3527",
  body: "#45503d",
  muted: "#7b6d53",
};

const FONT = "Georgia, 'Times New Roman', serif";

export const LOGIN_EMAIL_SUBJECT = "Вход в Личную CRM";

const LINK_LIFETIME = "Ссылка работает 15 минут.";

const NOT_YOU = "Если вы не запрашивали вход — просто проигнорируйте письмо.";

export type LoginEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildLoginEmail(url: string): LoginEmail {
  const href = escapeHtml(url);

  const html = `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>${LOGIN_EMAIL_SUBJECT}</title></head>
<body style="margin:0;padding:24px;background:${COLORS.paper};font-family:${FONT};color:${COLORS.body};">
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:${COLORS.heading};">${LOGIN_EMAIL_SUBJECT}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:24px;">Нажмите кнопку, чтобы войти.</p>
<p style="margin:0 0 24px;"><a href="${href}" style="display:inline-block;padding:12px 28px;border-radius:24px;background:${COLORS.button};color:${COLORS.buttonText};font-size:16px;font-weight:600;text-decoration:none;">Войти</a></p>
<p style="margin:0 0 8px;font-size:14px;line-height:20px;">${LINK_LIFETIME}</p>
<p style="margin:0;font-size:14px;line-height:20px;color:${COLORS.muted};">${NOT_YOU}</p>
</body>
</html>`;

  const text = [
    "Чтобы войти в Личную CRM, откройте ссылку:",
    url,
    "",
    LINK_LIFETIME,
    "",
    NOT_YOU,
  ].join("\n");

  return { subject: LOGIN_EMAIL_SUBJECT, html, text };
}
