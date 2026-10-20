import { createCn } from "cn/config";

// cn merges conflicting Tailwind classes. It has to know the custom scales
// from src/styles/tokens.css: otherwise it takes a size such as `text-cta`
// for a text colour and drops it next to `text-ink`. Keep these lists in
// sync with tokens.css.
export const cn = createCn({
  extend: {
    theme: {
      text: [
        "logo",
        "logo-md",
        "date",
        "date-md",
        "h1",
        "h1-md",
        "lead",
        "lead-md",
        "h2",
        "h2-md",
        "body",
        "body-md",
        "intro-md",
        "feature",
        "feature-md",
        "mark",
        "mark-md",
        "cta",
        "cta-md",
        "arrow",
        "sticker-title",
        "sticker-title-md",
        "sticker-note",
        "sticker-note-md",
      ],
      spacing: [
        "row",
        "hero-wrap-r",
        "hero-l",
        "hero-r",
        "ribbon-r",
        "sheet-l",
        "sheet-r",
        "grid-x",
        "problem-l",
        "problem-r",
        "solution-r",
        "benefits-l",
        "benefits-r",
      ],
      radius: ["hero", "hero-md", "pill"],
      shadow: ["hero", "hero-md", "sticker", "sticker-md", "tape"],
      "inset-shadow": ["ribbon", "ribbon-md"],
      "drop-shadow": ["sheet", "sheet-md"],
      font: ["serif", "serif-italic", "sans", "hand"],
    },
  },
});
