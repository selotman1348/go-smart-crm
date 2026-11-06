import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Notes",
};

export default function NotesPage() {
  return <PlaceholderPage title="Notes" description="Notes are planned for a later version. Case-related contacts are logged on each case's Communications tab." />;
}
