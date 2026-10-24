"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setKeepInTouchAction } from "@/app/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KeepInTouchInterval } from "@/db/schema";
import { KEEP_IN_TOUCH_LABELS } from "@/lib/format";
import { KEEP_IN_TOUCH_INTERVALS } from "@/lib/validation";

// The select needs a value for "Не задано"; the action gets null instead.
const NOT_SET = "none";

const ITEMS = [
  { value: NOT_SET, label: "Не задано" },
  ...KEEP_IN_TOUCH_INTERVALS.map((interval) => ({
    value: interval,
    label: KEEP_IN_TOUCH_LABELS[interval],
  })),
];

const SAVE_FAILED =
  "Не получилось сохранить частоту. Проверьте, что база данных запущена, и попробуйте ещё раз.";

// Saved as soon as it is chosen, without the edit form. The new value shows
// at once and goes back if saving fails.
export function KeepInTouchSelect({
  contactId,
  every,
}: {
  contactId: number;
  every: KeepInTouchInterval | null;
}) {
  const [value, setValue] = useState<string>(every ?? NOT_SET);
  const [, startTransition] = useTransition();

  function handleChange(next: string | null) {
    if (next === null || next === value) {
      return;
    }

    const previous = value;
    setValue(next);

    startTransition(async () => {
      try {
        const result = await setKeepInTouchAction(
          contactId,
          next === NOT_SET ? null : next,
        );

        if (!result.ok) {
          setValue(previous);
          toast.error(result.message ?? SAVE_FAILED);
        }
      } catch {
        setValue(previous);
        toast.error(SAVE_FAILED);
      }
    });
  }

  return (
    <Select items={ITEMS} value={value} onValueChange={handleChange}>
      {/* Phones: the label is on the rule above, and a text line starts 10px
          below a rule, so the box lifted by 10px sits between two rules.
          Wider screens: the box stays on the label's line. */}
      <SelectTrigger
        aria-label="Как часто общаться"
        className="relative max-md:-top-10"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
