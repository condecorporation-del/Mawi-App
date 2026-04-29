import "server-only";

// Patterns that suggest the user's message needs clarification before the agent acts.
const AMBIGUOUS_PATTERNS = [
  /\bpagar?\b.*\bfactura(s)?\b/i,
  /\bregistrar?\b.*\bgasto(s)?\b/i,
  /\bcreate?\b.*\bexpense(s)?\b/i,
];

const CLARIFICATIONS: Record<string, string> = {
  payment: "¿A cuál factura te refieres? Por favor proporciona el número de factura o el proveedor.",
  expense: "¿A qué proyecto corresponde este gasto? Proporciona el código o nombre del proyecto.",
};

type AmbiguityResult =
  | { ambiguous: false }
  | { ambiguous: true; clarification: string };

export function checkForAmbiguity(message: string): AmbiguityResult {
  if (AMBIGUOUS_PATTERNS[0].test(message) && !/número|folio|uuid/i.test(message)) {
    return { ambiguous: true, clarification: CLARIFICATIONS.payment };
  }

  if (AMBIGUOUS_PATTERNS[1].test(message) && !/proyecto|obra/i.test(message)) {
    return { ambiguous: true, clarification: CLARIFICATIONS.expense };
  }

  return { ambiguous: false };
}
