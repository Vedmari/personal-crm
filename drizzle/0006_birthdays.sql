ALTER TABLE "contacts" ADD COLUMN "birth_day" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_month" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_birthday_valid" CHECK (
      ("contacts"."birth_day" is null and "contacts"."birth_month" is null and "contacts"."birth_year" is null)
      or (
        "contacts"."birth_day" is not null and "contacts"."birth_month" is not null
        and "contacts"."birth_month" between 1 and 12
        and ("contacts"."birth_year" is null or "contacts"."birth_year" between 1 and 9999)
        and "contacts"."birth_day" between 1 and case
          when "contacts"."birth_month" in (4,6,9,11) then 30
          when "contacts"."birth_month" <> 2 then 31
          when "contacts"."birth_year" is null or mod("contacts"."birth_year",400)=0
            or (mod("contacts"."birth_year",4)=0 and mod("contacts"."birth_year",100)<>0) then 29
          else 28 end
      )
    );