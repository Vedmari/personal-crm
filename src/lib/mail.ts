import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

// Where the letters go is decided by SMTP_URL, not by the code: Mailpit on
// this computer and in CI (smtp://localhost:1025), Resend on the server
// (smtps://resend:<key>@smtp.resend.com:2465 — the hosting provider blocks
// outgoing 465 and 587). The same build works everywhere.

export const MAIL_FROM = '"Личная CRM" <noreply@mail.crm.lichnaya-crm.ru>';

// A failed sending says only why it failed (the code of Nodemailer, like
// "ECONNECTION" or "EENVELOPE"), never to whom: Nodemailer's own messages
// quote the address, and Next.js writes thrown errors to the server log.
export class MailError extends Error {
  constructor(public readonly code: string) {
    super(`sendMail failed: ${code}`);
    this.name = "MailError";
  }
}

let transporter: Transporter | undefined;

// Made at the first letter, not when the module is imported: building the
// image needs no SMTP_URL.
function getTransporter(): Transporter {
  if (!transporter) {
    const url = process.env.SMTP_URL;

    if (!url) {
      throw new MailError("SMTP_URL_NOT_SET");
    }

    transporter = nodemailer.createTransport({
      url,
      // A mail service that does not answer fails in seconds, not minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }

  return transporter;
}

export async function sendMail(letter: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  try {
    await getTransporter().sendMail({ from: MAIL_FROM, ...letter });
  } catch (error) {
    if (error instanceof MailError) {
      throw error;
    }

    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "UNKNOWN";

    throw new MailError(code);
  }
}
