"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardErrorProps = {
  reset: () => void;
};

export default function DashboardError({ reset }: DashboardErrorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No pudimos cargar la informacion</CardTitle>
        <CardDescription>
          Intenta nuevamente. Si el problema continua, contacta soporte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={reset}>Reintentar</Button>
      </CardContent>
    </Card>
  );
}
