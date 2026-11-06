import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Surveys",
};

export default function SurveysPage() {
  return <PlaceholderPage title="Surveys" description="Customer surveys are planned for a later version." />;
}
