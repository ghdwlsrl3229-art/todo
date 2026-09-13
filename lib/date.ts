/**
 * Today's date as YYYY-MM-DD in the browser's local calendar, matching what
 * an `<input type="date">` shows the user. `toISOString()` would report
 * yesterday's date for anyone west of UTC between midnight and their UTC
 * offset (e.g. KST users see "yesterday" until 09:00 local).
 */
export function todayIsoLocal(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
