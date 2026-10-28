import Link from "next/link";

import { DATE_LINE_CLASS_NAME } from "@/components/paper";
import { ButtonDot, buttonVariants } from "@/components/ui/button";

// A page torn out of the notebook, like the notes sheet of the card: lined,
// with the holes of the spiral and a torn bottom edge. The heading is
// handwritten in blue ink.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-14 py-56 md:py-120">
      <section className="w-full max-w-640 -rotate-1 drop-shadow-sheet md:drop-shadow-sheet-md">
        <div className="flex flex-col bg-paper paper-lined ring-holes torn-bottom pt-42 pr-72 pb-46 pl-30 md:pr-sheet-r md:pb-54 md:pl-sheet-l">
          <p className={DATE_LINE_CLASS_NAME}>
            Этой страницы в ежедневнике нет
          </p>
          <h1 className="relative -top-7 mt-row font-hand text-h2 font-bold text-ink-blue md:-top-9 md:text-h2-md">
            Такой страницы нет
          </h1>
          <p className="font-sans text-body text-pretty text-ink-body md:text-body-md">
            Возможно, ссылка устарела или в адресе опечатка.
          </p>
          <Link
            href="/"
            transitionTypes={["page-back"]}
            className={buttonVariants({
              size: "lg",
              className: "mt-row self-start",
            })}
          >
            Ко всем контактам
            <ButtonDot>→</ButtonDot>
          </Link>
        </div>
      </section>
    </main>
  );
}
