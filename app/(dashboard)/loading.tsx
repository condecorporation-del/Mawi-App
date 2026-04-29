import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 rounded bg-secondary" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-10 rounded bg-secondary" />
        <div className="h-10 rounded bg-secondary" />
        <div className="h-10 rounded bg-secondary" />
      </CardContent>
    </Card>
  );
}
