import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Menu items whose behaviour is not specified for version 1 (requirements.md
 * section 4, plan.md section 6): a page that says so.
 */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Not part of version 1</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
