import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Nothing to show yet</CardTitle>
          <CardDescription>
            Open tasks and case trends will appear here once cases are added.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
