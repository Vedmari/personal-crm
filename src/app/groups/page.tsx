import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/contact-list";
import { GroupCreateForm } from "@/components/group-create-form";
import { GroupRow } from "@/components/group-row";
import {
  Cover,
  DATE_LINE_CLASS_NAME,
  DIARY_SHEET_X,
  DiarySheet,
} from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { listGroups } from "@/db/queries";
import { cn } from "@/lib/utils";

// Text on the sheet sits on its 32px rules: a line starts 10px below a rule,
// and every block takes a whole number of rules.
export default function GroupsPage() {
  return (
    <Cover>
      <main>
        <DiarySheet>
          <div className={cn(DIARY_SHEET_X, "pt-42 pb-56 md:pb-70")}>
            <div className="flex h-row items-center">
              <Link
                href="/"
                className={cn(
                  DATE_LINE_CLASS_NAME,
                  "flex w-fit items-center gap-8 rounded-sm whitespace-nowrap transition-colors hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-ring",
                )}
              >
                <span aria-hidden="true" className="text-arrow normal-case">
                  ←
                </span>
                Все контакты
              </Link>
            </div>
            <h1 className="relative -top-7 mt-row font-serif text-h2 font-medium text-ink md:-top-9 md:text-h2-md">
              Группы
            </h1>
            <div className="max-w-960">
              <GroupCreateForm />
              <div className="mt-row">
                <Suspense fallback={<GroupsListSkeleton />}>
                  <GroupsList />
                </Suspense>
              </div>
            </div>
          </div>
        </DiarySheet>
      </main>
    </Cover>
  );
}

async function GroupsList() {
  const groups = await listGroups();

  if (groups.length === 0) {
    return (
      <EmptyState mark="?" title="Групп пока нет">
        Создайте первую — например, «Семья» или «Теннис».
      </EmptyState>
    );
  }

  return (
    <ul>
      {groups.map((group) => (
        <GroupRow
          key={group.id}
          id={group.id}
          name={group.name}
          contactCount={group.contactCount}
        />
      ))}
    </ul>
  );
}

function GroupsListSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex h-64 items-center">
          <div className="flex-1 space-y-12">
            <Skeleton className="h-16 w-200 max-w-full" />
            <Skeleton className="h-14 w-120 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
