import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type InvoiceFiltersProps = {
  supplierIdName?: string;
  clientIdName?: string;
  projectIdName?: string;
};

export function InvoiceFilters({
  supplierIdName,
  clientIdName,
  projectIdName,
}: InvoiceFiltersProps) {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4">
      {supplierIdName ? (
        <Input name={supplierIdName} placeholder="Proveedor ID" />
      ) : null}
      {clientIdName ? <Input name={clientIdName} placeholder="Cliente ID" /> : null}
      {projectIdName ? (
        <Input name={projectIdName} placeholder="Proyecto ID" />
      ) : null}
      <Input name="dueBefore" placeholder="Vence antes de ISO date" />
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
    </form>
  );
}
