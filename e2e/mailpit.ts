// The letters of the app under test, read from the Mailpit mail catcher
// through its API (https://mailpit.axllent.org/docs/api-v1/). On this computer
// Mailpit runs from docker-compose.yml, in CI as a service of the E2E job.

import { expect } from "@playwright/test";

function mailpitUrl(): string {
  return process.env.MAILPIT_URL || "http://localhost:8025";
}

type MessageSummary = {
  ID: string;
  Created: string;
};

export type Letter = {
  from: { name: string; address: string };
  subject: string;
  html: string;
  text: string;
  // The sign-in link of the letter.
  link: string;
};

function searchQuery(address: string): string {
  return `query=${encodeURIComponent(`to:"${address}"`)}`;
}

// The letters to `address`, newest first.
async function lettersTo(address: string): Promise<MessageSummary[]> {
  const response = await fetch(
    `${mailpitUrl()}/api/v1/search?${searchQuery(address)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Mailpit search failed: ${response.status}. Is Mailpit running (podman compose up -d)?`,
    );
  }

  const body = (await response.json()) as { messages: MessageSummary[] };

  return body.messages;
}

export async function countLettersTo(address: string): Promise<number> {
  return (await lettersTo(address)).length;
}

// Forgets the letters to `address` left by earlier runs.
export async function clearLettersTo(address: string): Promise<void> {
  const response = await fetch(
    `${mailpitUrl()}/api/v1/search?${searchQuery(address)}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error(`Mailpit delete failed: ${response.status}`);
  }
}

async function readLetter(id: string): Promise<Letter> {
  const response = await fetch(`${mailpitUrl()}/api/v1/message/${id}`);
  const message = (await response.json()) as {
    From: { Name: string; Address: string };
    Subject: string;
    HTML: string;
    Text: string;
  };
  const link = /https?:\/\/\S+\/api\/auth\/magic-link\/verify\?\S+/.exec(
    message.Text,
  );

  return {
    from: { name: message.From.Name, address: message.From.Address },
    subject: message.Subject,
    html: message.HTML,
    text: message.Text,
    link: link?.[0] ?? "",
  };
}

// Waits until `count` letters have come to `address` and returns the newest.
export async function waitForLetter(
  address: string,
  count = 1,
): Promise<Letter> {
  let letters: MessageSummary[] = [];

  await expect
    .poll(
      async () => {
        letters = await lettersTo(address);
        return letters.length;
      },
      { message: `letters to ${address}`, timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(count);

  return readLetter(letters[0].ID);
}

// All letters Mailpit holds: the tests run one at a time, so a letter that
// went nowhere shows as an unchanged total.
export async function countAllLetters(): Promise<number> {
  const response = await fetch(`${mailpitUrl()}/api/v1/messages?limit=1`);
  const body = (await response.json()) as { total: number };

  return body.total;
}
