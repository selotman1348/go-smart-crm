import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Repair network",
};

export default function RepairNetworkPage() {
  return <PlaceholderPage title="Repair network" description="The network view is planned for a later version. Repairers and their agreed discounts are maintained under Accounts." />;
}
