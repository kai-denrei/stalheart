// Felt-it notes: a dated line about a moment that was satisfying or needs work, optionally tagged with the FunMap
// lesson it speaks to (R1-R20, or M for Meier). Pure: storage and the clipboard belong to the capture panel.
export const FELT_KINDS = Object.freeze(['satisfying', 'needs-work']);
export const FELT_LESSONS = Object.freeze([...Array.from({ length: 20 }, (_, i) => `R${i + 1}`), 'M']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 500;

function problem(n) {
  if (!n || typeof n !== 'object') return 'a note';
  if (typeof n.date !== 'string' || !DATE.test(n.date)) return 'a YYYY-MM-DD date';
  if (!FELT_KINDS.includes(n.kind)) return 'a kind (satisfying or needs-work)';
  if (typeof n.text !== 'string' || !n.text.trim() || n.text.trim().length > MAX_TEXT) return `some text (1 to ${MAX_TEXT} characters)`;
  if (n.lesson !== undefined && n.lesson !== '' && !FELT_LESSONS.includes(n.lesson)) return 'a lesson of R1-R20 or M, or none';
  return null;
}

function clean(n) {
  const note = { date: n.date, kind: n.kind, text: n.text.trim() };
  if (n.lesson) note.lesson = n.lesson;
  return note;
}

export function addNote(notes, input) {
  const why = problem(input);
  if (why) throw Error(`A felt note needs ${why}.`);
  return [...notes, clean(input)];
}

export function sanitiseNotes(raw) {
  let value = raw;
  if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { return []; } }
  return Array.isArray(value) ? value.filter((n) => !problem(n)).map(clean) : [];
}

export const toFunmapLines = (notes) => notes
  .map((n) => `- ${n.date} · ${n.kind === 'needs-work' ? 'needs work: ' : ''}${n.text}${n.lesson ? ` · ${n.lesson}` : ''}`)
  .join('\n');

export const toJson = (notes) => JSON.stringify(notes, null, 2);
