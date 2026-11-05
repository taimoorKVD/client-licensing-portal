/** Fixed book date so the demo roster does not drift with the clock. */
export const PORTAL_AS_OF = "2026-11-05";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(...parts(fromIso));
  const to = Date.UTC(...parts(toIso));
  return Math.round((to - from) / 86_400_000);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  const label = MONTHS[month - 1];
  if (!label || !year || !day) return iso;
  return `${label} ${day}, ${year}`;
}

export function formatDateLong(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[month - 1]} ${day}, ${year}`;
}

function parts(iso: string): [number, number, number] {
  const [year, month, day] = iso.split("-").map(Number);
  return [year, month - 1, day];
}
