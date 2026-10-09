"use client";

import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 200;

const INPUT_CLASS_NAME = "h-10 rounded-xl bg-card px-9 text-base md:text-base";

// The search text lives in the URL (?q=...), so the server does the filtering
// and a reloaded or shared link shows the same results.
export function SearchBox() {
  const router = useRouter();
  const urlQuery = (useSearchParams().get("q") ?? "").trim();
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
        router.replace(query ? `/?q=${encodeURIComponent(query)}` : "/");
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [isDirty, query, urlQuery, router]);

  function handleChange(nextValue: string) {
    setValue(nextValue);
    setIsDirty(true);
  }

  return (
    <div className="relative">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="text"
        role="searchbox"
        enterKeyHint="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        autoComplete="off"
        spellCheck={false}
        className={INPUT_CLASS_NAME}
      />
      {isPending ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => {
            handleChange("");
            inputRef.current?.focus();
          }}
          aria-label="Очистить поиск"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon aria-hidden="true" className="size-4" />
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        disabled
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        className={INPUT_CLASS_NAME}
      />
    </div>
  );
}
