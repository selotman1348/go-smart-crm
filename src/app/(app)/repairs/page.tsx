import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Repairs dashboard",
};

export default function RepairsDashboardPage() {
  return <PlaceholderPage title="Repairs dashboard" description="A dashboard for the repair network is planned for a later version." />;
}
