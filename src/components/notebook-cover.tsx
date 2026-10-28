"use client";

import { useEffect } from "react";

import { withoutLandingMark } from "@/lib/notebook";

// Opens the cover at once: the page under it is ready.
function openCover() {
  document.documentElement.removeAttribute("data-cover");
}

// The closed notebook lying on the baize. The script in <head> (coverScript in
// src/lib/notebook.ts) decides before the first paint whether it is shown;
// the cover then swings open by itself in CSS (.notebook-cover in
// globals.css), without waiting for this component. The component only lets
// a press or a key open it at once, takes it away when the animation ends and
// drops the landing mark from the address.
export function NotebookCover() {
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-cover")) {
      return;
    }

    const search = withoutLandingMark(window.location.search);

    if (search !== window.location.search) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + search + window.location.hash,
      );
    }

    window.addEventListener("keydown", openCover, { once: true });

    return () => window.removeEventListener("keydown", openCover);
  }, []);

  return (
    <div
      data-notebook-cover
      aria-hidden="true"
      className="notebook-cover"
      onClick={openCover}
      onAnimationEnd={(event) => {
        if (event.animationName.startsWith("notebook-cover-")) {
          openCover();
        }
      }}
    >
      <div className="notebook-cover-board">
        <div className="notebook-cover-front">
          <div className="notebook-cover-frame" />
          <div className="notebook-cover-title">
            {/* The logo's clover, stamped in gold. */}
            <span className="relative size-48 md:size-64">
              <span className="absolute top-0 left-1/4 size-1/2 rounded-full bg-gilt" />
              <span className="absolute top-1/2 left-1/4 size-1/2 rounded-full bg-gilt" />
              <span className="absolute top-1/4 left-0 size-1/2 rounded-full bg-gilt" />
              <span className="absolute top-1/4 left-1/2 size-1/2 rounded-full bg-gilt" />
              <span className="absolute top-1/4 left-1/4 size-1/2 bg-gilt" />
            </span>
            <span className="font-serif text-h2 font-medium text-gilt md:text-h2-md">
              Личная CRM
            </span>
          </div>
        </div>
        <div className="notebook-cover-back" />
      </div>
    </div>
  );
}
