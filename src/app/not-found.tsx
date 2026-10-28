import Link from "next/link";

import {
  STICKER_TEXT_CLASS_NAME,
  StickerNote,
} from "@/components/sticker-note";
import { ButtonDot, buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StickerNote title="Такой страницы нет">
      <p className={STICKER_TEXT_CLASS_NAME}>
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Link
        href="/"
        className={buttonVariants({
          size: "lg",
          className: "mt-8 self-start md:mt-12",
        })}
      >
        Ко всем контактам
        <ButtonDot>→</ButtonDot>
      </Link>
    </StickerNote>
  );
}
