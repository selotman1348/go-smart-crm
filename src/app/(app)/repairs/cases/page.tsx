import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Cases per repairer",
};

export default function RepairCasesPage() {
  return <PlaceholderPage title="Cases per repairer" description="Cases per repairer are planned for a later version. The case list can already be filtered by repairer." />;
}
