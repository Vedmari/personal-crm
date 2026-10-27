"use client";

import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { listHref } from "@/lib/list-filter";
import { parseId } from "@/lib/validation";

const DEBOUNCE_MS = 200;

// A pill as tall as the "Добавить контакт" button next to it.
const INPUT_CLASS_NAME = "h-52 rounded-pill pr-44 pl-46";

const SEARCH_PLACEHOLDER = "Имя или кто это";
const SEARCH_LABEL = "Поиск по имени и по полю «Кто это»";

// The search text lives in the URL (?q=...), so the server does the filtering
// and a reloaded or shared link shows the same results.
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") ?? "").trim();
  // Typing must not drop the chosen group.
  const group = parseId(searchParams.get("group"));
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(urlQuery);
  // True while the user has typed something the URL has not caught up with.
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const query = value.trim();

  if (isDirty && query === urlQuery) {
    setIsDirty(false);
  }

  // The URL changed on its own (search was reset, history navigation):
  // the field follows it.
  if (!isDirty && query !== urlQuery) {
    setValue(urlQuery);
  }

  // On a slow first load the field is visible before the page becomes
  // interactive. Text typed in that window is picked up here.
  useEffect(() => {
    const typedEarly = inputRef.current?.value ?? "";

    if (typedEarly !== urlQuery) {
      setValue(typedEarly);
      setIsDirty(true);
    }
    // Runs once, right after the field becomes interactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDirty || query === urlQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(listHref({ q: query, group }));
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [isDirty, query, urlQuery, group, router]);

  function handleChange(nextValue: string) {
    setValue(nextValue);
    setIsDirty(true);
  }

  return (
    <div className="relative">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-18 size-18 -translate-y-1/2 text-ink-muted"
      />
      <Input
        ref={inputRef}
        type="text"
        role="searchbox"
        enterKeyHint="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        aria-label={SEARCH_LABEL}
        autoComplete="off"
        spellCheck={false}
        className={INPUT_CLASS_NAME}
      />
      {isPending ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="absolute top-1/2 right-16 size-18 -translate-y-1/2 animate-spin text-ink-muted"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => {
            handleChange("");
            inputRef.current?.focus();
          }}
          aria-label="Очистить поиск"
          className="absolute top-1/2 right-8 flex size-36 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-ink-strong/6 hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-ring"
        >
          <XIcon aria-hidden="true" className="size-18" />
        </button>
      ) : null}
    </div>
  );
}

// Shown in the static page shell until the URL is known.
export function SearchBoxFallback() {
  return (
    <div className="relative">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-18 size-18 -translate-y-1/2 text-ink-muted"
      />
      <Input
        type="text"
        disabled
        placeholder={SEARCH_PLACEHOLDER}
        aria-label={SEARCH_LABEL}
        className={INPUT_CLASS_NAME}
      />
    </div>
  );
}
