import { TornOutSheet } from "@/components/torn-out-sheet";

// A card number that is not in this user's book: deleted, mistyped, or
// another user's contact. The page is the same for all of them, so it does
// not tell whether somebody else has a contact with this number.
export default function ContactNotFound() {
  return (
    <TornOutSheet
      dateLine="Этой карточки в ежедневнике нет"
      title="Контакт не найден"
    >
      Возможно, контакт удалили или в адресе опечатка.
    </TornOutSheet>
  );
}
