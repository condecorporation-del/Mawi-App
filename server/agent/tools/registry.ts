import { createExpenseDraftTool } from "./create-expense-draft";
import { createProjectTool } from "./create-project";
import { generateProjectReportTool } from "./generate-project-report";
import { getProjectBalanceTool } from "./get-project-balance";
import { getProjectSummaryTool } from "./get-project-summary";
import { getSupplierBalanceTool } from "./get-supplier-balance";
import { listOverdueInvoicesTool } from "./list-overdue-invoices";
import { listProjectsTool } from "./list-projects";
import { markInvoicePaidTool } from "./mark-invoice-paid";
import { registerIncomeTool } from "./register-income";
import { registerSupplierInvoiceTool } from "./register-supplier-invoice";
import { updateProjectTool } from "./update-project";

export const agentToolRegistry = [
  // Lectura — proyectos
  listProjectsTool,
  getProjectSummaryTool,
  getProjectBalanceTool,
  generateProjectReportTool,
  // Lectura — finanzas
  listOverdueInvoicesTool,
  getSupplierBalanceTool,
  // Mutaciones — proyectos
  createProjectTool,
  updateProjectTool,
  // Mutaciones — gastos e ingresos
  createExpenseDraftTool,
  registerIncomeTool,
  registerSupplierInvoiceTool,
  markInvoicePaidTool,
] as const;
