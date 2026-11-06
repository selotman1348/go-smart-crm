import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return <PlaceholderPage title="Leads" description="Lead management is planned for a later version. The dashboard's lead-generation chart will use it." />;
}
