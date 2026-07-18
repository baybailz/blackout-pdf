export interface PatternDef {
  id: string;
  label: string;
  regex: RegExp;
}

// Order matters: earlier patterns claim their text first, so more specific
// formats (SSN) must precede looser ones (phone numbers).
export const PATTERNS: PatternDef[] = [
  {
    id: "ssn",
    label: "Social Security numbers",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    id: "card",
    label: "Card numbers",
    regex: /\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b|\b\d{16}\b/g,
  },
  {
    id: "email",
    label: "Email addresses",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    id: "phone",
    label: "Phone numbers",
    regex:
      /(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}\b/g,
  },
];

export const CUSTOM_PATTERN_ID = "custom";

export function customTermRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "gi");
}
