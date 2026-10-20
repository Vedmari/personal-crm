// The same font files as on the landing: variable Alegreya and Caveat,
// static Alegreya 500 italic and Alegreya Sans.
import "@fontsource-variable/alegreya/wght.css";
import "@fontsource/alegreya/500-italic.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource-variable/caveat/wght.css";

import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично",
};

export const viewport: Viewport = {
  // Same value as --color-book-cover in src/styles/tokens.css: meta tags cannot read CSS variables.
  themeColor: "#3f5a3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-book-cover font-sans text-ink-body lining-nums">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
