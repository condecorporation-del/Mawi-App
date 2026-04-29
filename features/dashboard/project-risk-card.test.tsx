import { describe, expect, it } from "vitest";

import DashboardLoading from "@/app/(dashboard)/loading";
import { ProjectRiskCard } from "@/features/dashboard/project-risk-card";

describe("dashboard UI states", () => {
  it("renders loading state without throwing", () => {
    expect(DashboardLoading()).toBeTruthy();
  });

  it("renders project risk empty state without throwing", () => {
    expect(ProjectRiskCard({ risks: [] })).toBeTruthy();
  });
});
