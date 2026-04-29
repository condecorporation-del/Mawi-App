export function formatCurrencyCents(amountCents: number) {
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountCents / 100);
}

export function formatBasisPoints(basisPoints: number) {
  return `${(basisPoints / 100).toFixed(1)}%`;
}
