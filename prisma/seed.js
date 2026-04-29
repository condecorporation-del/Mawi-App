// @ts-check
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ─── IDs fijos del tenant base ─────────────────────────────────────────────────
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

// ─── IDs deterministas para datos demo (permiten upsert idempotente) ──────────
const CLIENT_ID    = "00000000-0000-4000-8000-000000000001";
const SUPPLIER_1   = "00000000-0000-4000-8000-000000000002"; // materiales
const SUPPLIER_2   = "00000000-0000-4000-8000-000000000003"; // mano de obra
const PROJECT_ID   = "00000000-0000-4000-8000-000000000004";
const CONTRACT_ID  = "00000000-0000-4000-8000-000000000005";

const BL_STRUCT = "00000000-0000-4000-8000-000000000011";
const BL_ACAB   = "00000000-0000-4000-8000-000000000012";
const BL_INST   = "00000000-0000-4000-8000-000000000013";
const BL_IMP    = "00000000-0000-4000-8000-000000000014";

const MS_1 = "00000000-0000-4000-8000-000000000021";
const MS_2 = "00000000-0000-4000-8000-000000000022";
const MS_3 = "00000000-0000-4000-8000-000000000023";

// IDs de facturas y gastos por mes (m=0 → 5 meses atrás, m=5 → mes actual)
const invRecId = (m) => `00000000-0000-4000-8000-0000001000${String(m + 1).padStart(2, "0")}`;
const exp1Id   = (m) => `00000000-0000-4000-8000-0000002000${String(m + 1).padStart(2, "0")}`;
const exp2Id   = (m) => `00000000-0000-4000-8000-0000003000${String(m + 1).padStart(2, "0")}`;

const INV_OVERDUE_PAY  = "00000000-0000-4000-8000-000000009001";
const INV_OVERDUE_REC  = "00000000-0000-4000-8000-000000009002";
const INV_UPCOMING_PAY = "00000000-0000-4000-8000-000000009003";

// ─── Montos por mes en centavos (MXN × 100) ────────────────────────────────────
// Índice: 0 = 5 meses atrás … 5 = mes actual
// Ingresos: facturas por cobrar emitidas ese mes
const INCOME_CENTS  = [70_000_000, 85_000_000, 65_000_000, 90_000_000, 75_000_000, 95_000_000];
// Gastos: materiales (sup 1) — acumulado ~$2.73M MXN = 91% del presupuesto → alerta warning
const EXPENSE_MAT   = [25_000_000, 28_000_000, 22_000_000, 26_000_000, 27_000_000, 30_000_000];
// Gastos: mano de obra (sup 2)
const EXPENSE_MO    = [18_000_000, 20_000_000, 16_000_000, 19_000_000, 20_000_000, 22_000_000];

async function main() {
  const userId = process.env.SEED_USER_ID;
  if (!userId) {
    throw new Error(
      "Falta SEED_USER_ID. Ejecútalo así:\n  SEED_USER_ID=<tu-uuid-de-supabase> npm run db:seed",
    );
  }

  const now = new Date();

  // ── 1. Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: "ConstructAI Demo", rfc: "CON000000AAA" },
  });

  // ── 2. Membresía ─────────────────────────────────────────────────────────────
  const membership = await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    update: { isActive: true, role: "owner" },
    create: { tenantId: tenant.id, userId, role: "owner", isActive: true },
  });

  console.log(`Tenant : ${tenant.name} (${tenant.id})`);
  console.log(`Member : ${membership.id} — role: ${membership.role}`);

  // ── 3. Cliente ───────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { id: CLIENT_ID },
    update: {},
    create: {
      id: CLIENT_ID,
      tenantId: TENANT_ID,
      name: "Inmobiliaria Palmeras SA de CV",
      rfc: "IPL010101AAA",
      email: "finanzas@palmeras.mx",
      phone: "55 1234 5678",
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 4. Proveedores ───────────────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { id: SUPPLIER_1 },
    update: {},
    create: {
      id: SUPPLIER_1,
      tenantId: TENANT_ID,
      name: "Cementos y Aceros del Norte SA",
      rfc: "CAN090909CCC",
      email: "ventas@cementosnorte.mx",
      phone: "81 2345 6789",
      createdBy: userId,
      updatedBy: userId,
    },
  });

  await prisma.supplier.upsert({
    where: { id: SUPPLIER_2 },
    update: {},
    create: {
      id: SUPPLIER_2,
      tenantId: TENANT_ID,
      name: "Constructores Unidos SC",
      rfc: "CUS080808BBB",
      email: "obras@cunidos.mx",
      phone: "81 3456 7890",
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 5. Proyecto ──────────────────────────────────────────────────────────────
  // Presupuesto: $3,000,000 MXN. Gasto total demo: ~$2,730,000 (91%) → alerta warning
  const project = await prisma.project.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PRY-2025-001" } },
    update: {},
    create: {
      id: PROJECT_ID,
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      code: "PRY-2025-001",
      name: "Torre Residencial Palmeras",
      description: "Edificio de 12 pisos con 48 departamentos en Monterrey NL.",
      status: "active",
      budgetCents: 300_000_000,
      startsAt: new Date(Date.UTC(2025, 10, 1)),
      endsAt: new Date(Date.UTC(2026, 9, 31)),
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 6. Partidas de presupuesto ───────────────────────────────────────────────
  const budgetLines = [
    { id: BL_STRUCT, name: "Estructura y cimentación",       budgetCents: 120_000_000 },
    { id: BL_ACAB,   name: "Acabados arquitectónicos",        budgetCents: 80_000_000  },
    { id: BL_INST,   name: "Instalaciones hidrosanitarias",   budgetCents: 60_000_000  },
    { id: BL_IMP,    name: "Imprevistos y contingencias",     budgetCents: 40_000_000  },
  ];

  for (const bl of budgetLines) {
    await prisma.budgetLine.upsert({
      where: { id: bl.id },
      update: {},
      create: {
        id: bl.id,
        tenantId: TENANT_ID,
        projectId: project.id,
        name: bl.name,
        budgetCents: bl.budgetCents,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  // ── 7. Contrato ──────────────────────────────────────────────────────────────
  const contract = await prisma.contract.upsert({
    where: { id: CONTRACT_ID },
    update: {},
    create: {
      id: CONTRACT_ID,
      tenantId: TENANT_ID,
      projectId: project.id,
      clientId: CLIENT_ID,
      contractNumber: "CON-2025-0001",
      title: "Contrato de Obra Torre Residencial Palmeras",
      status: "active",
      totalCents: 420_000_000,
      signedAt: new Date(Date.UTC(2025, 10, 5)),
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 8. Hitos de contrato ─────────────────────────────────────────────────────
  const milestones = [
    { id: MS_1, name: "Cimentación y estructura",            amountCents: 140_000_000, dueDate: new Date(Date.UTC(2026, 1, 28)) },
    { id: MS_2, name: "Instalaciones y acabados gruesos",    amountCents: 140_000_000, dueDate: new Date(Date.UTC(2026, 5, 30)) },
    { id: MS_3, name: "Entrega final y recepciones",         amountCents: 140_000_000, dueDate: new Date(Date.UTC(2026, 9, 15)) },
  ];

  for (const ms of milestones) {
    await prisma.milestone.upsert({
      where: { id: ms.id },
      update: {},
      create: {
        id: ms.id,
        tenantId: TENANT_ID,
        contractId: contract.id,
        name: ms.name,
        amountCents: ms.amountCents,
        dueDate: ms.dueDate,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  // ── 9. Datos mensuales: 6 meses de facturas por cobrar y gastos ───────────────
  // m=0 → 5 meses atrás (más antiguo), m=5 → mes actual
  for (let m = 0; m < 6; m++) {
    const monthsBack = 5 - m;
    const issueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 10));
    const dueDate   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 10));
    const isCurrentMonth = monthsBack === 0;
    const monthLabel = issueDate.toISOString().slice(0, 7);

    // Factura por cobrar (ingreso del mes)
    await prisma.invoice.upsert({
      where: { id: invRecId(m) },
      update: {},
      create: {
        id: invRecId(m),
        tenantId: TENANT_ID,
        type: "receivable",
        status: isCurrentMonth ? "approved" : "paid",
        number: `FAC-COB-2025-${String(m + 1).padStart(3, "0")}`,
        clientId: CLIENT_ID,
        projectId: project.id,
        contractId: contract.id,
        issueDate,
        dueDate,
        totalCents: INCOME_CENTS[m],
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Gasto 1 — materiales (partida: Estructura)
    await prisma.expense.upsert({
      where: { id: exp1Id(m) },
      update: {},
      create: {
        id: exp1Id(m),
        tenantId: TENANT_ID,
        projectId: project.id,
        supplierId: SUPPLIER_1,
        budgetLineId: BL_STRUCT,
        description: `Compra de materiales de construcción — ${monthLabel}`,
        totalCents: EXPENSE_MAT[m],
        expenseDate: issueDate,
        status: "approved",
        source: "manual",
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Gasto 2 — mano de obra (partida: Acabados)
    await prisma.expense.upsert({
      where: { id: exp2Id(m) },
      update: {},
      create: {
        id: exp2Id(m),
        tenantId: TENANT_ID,
        projectId: project.id,
        supplierId: SUPPLIER_2,
        budgetLineId: BL_ACAB,
        description: `Mano de obra especializada — ${monthLabel}`,
        totalCents: EXPENSE_MO[m],
        expenseDate: issueDate,
        status: "approved",
        source: "manual",
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  // ── 10. Factura por pagar vencida (activa alerta payment_overdue) ─────────────
  await prisma.invoice.upsert({
    where: { id: INV_OVERDUE_PAY },
    update: {},
    create: {
      id: INV_OVERDUE_PAY,
      tenantId: TENANT_ID,
      type: "payable",
      status: "pending_review",
      number: "FAC-PAG-2025-001",
      supplierId: SUPPLIER_1,
      projectId: project.id,
      issueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10)),
      dueDate:   new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 25)),
      totalCents: 15_000_000, // $150,000 MXN vencida
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 11. Factura por cobrar vencida (activa alerta de cobranza) ────────────────
  await prisma.invoice.upsert({
    where: { id: INV_OVERDUE_REC },
    update: {},
    create: {
      id: INV_OVERDUE_REC,
      tenantId: TENANT_ID,
      type: "receivable",
      status: "approved",
      number: "FAC-COB-2025-007",
      clientId: CLIENT_ID,
      projectId: project.id,
      issueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10)),
      dueDate:   new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 25)),
      totalCents: 20_000_000, // $200,000 MXN por cobrar vencida
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ── 12. Factura por pagar próxima (visible en flujo de caja a 30 días) ────────
  await prisma.invoice.upsert({
    where: { id: INV_UPCOMING_PAY },
    update: {},
    create: {
      id: INV_UPCOMING_PAY,
      tenantId: TENANT_ID,
      type: "payable",
      status: "approved",
      number: "FAC-PAG-2025-002",
      supplierId: SUPPLIER_2,
      projectId: project.id,
      issueDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5)),
      dueDate:   new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 15)),
      totalCents: 12_000_000, // $120,000 MXN próxima a vencer
      createdBy: userId,
      updatedBy: userId,
    },
  });

  // ─── Resumen ──────────────────────────────────────────────────────────────────
  const totalExpenses = [...EXPENSE_MAT, ...EXPENSE_MO].reduce((s, v) => s + v, 0);
  const pctBudget = Math.round((totalExpenses / 300_000_000) * 100);

  console.log(`\n✓ Datos demo creados:`);
  console.log(`  Cliente   : ${client.name}`);
  console.log(`  Proyecto  : ${project.name}`);
  console.log(`  Presupuesto: $3,000,000 MXN | Gasto total: $${(totalExpenses / 100).toLocaleString("es-MX")} MXN (${pctBudget}%) → alerta warning`);
  console.log(`  Facturas  : 6 por cobrar + 1 vencida por cobrar + 1 vencida por pagar + 1 próxima por pagar`);
  console.log(`  Gastos    : 12 registros (2 por mes × 6 meses)`);
  console.log(`\n  Abre /dashboard para ver KPIs, gráfica de 6 meses y alertas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
