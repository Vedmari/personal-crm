import { TornOutSheet } from "@/components/torn-out-sheet";

export default function NotFound() {
  return (
    <TornOutSheet
      dateLine="Этой страницы в ежедневнике нет"
      title="Такой страницы нет"
    >
      Возможно, ссылка устарела или в адресе опечатка.
    </TornOutSheet>
  );
}
