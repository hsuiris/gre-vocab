// How the word-list player walks the list: how many times each word is read,
// and whether it wraps round a chosen stretch instead of running to the end.
// Kept here as plain arithmetic so it can be tested without a speech engine.

export type PlayPlan = {
  example: boolean; // read the example sentence after the word
  chinese: boolean; // read the meaning, and the translated example
  repeat: number; // times each word is read before moving on
  loop: boolean;
  from: number; // 1-based, as typed by the reader; 0 means "the start"
  to: number; // 1-based; 0 means "the end"
};

// Turns whatever was typed into two indexes the list actually has. A blank box
// arrives as 0 and means the far end; a range typed backwards is read as a
// range rather than as nothing.
export function clampRange(from: number, to: number, length: number): { from: number; to: number } {
  if (length <= 0) return { from: 0, to: -1 };
  const pin = (n: number, fallback: number) =>
    Math.min(Math.max(Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback, 1), length) - 1;
  const a = pin(from, 1);
  const b = pin(to, length);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

// Where pressing play should start. Outside the loop range there is nothing to
// wrap round, so playback joins the range at its start.
export function startAt(at: number, length: number, plan: PlayPlan): number {
  if (!plan.loop) return at;
  const { from, to } = clampRange(plan.from, plan.to, length);
  return at >= from && at <= to ? at : from;
}

// What comes after finishing reading `at` for the `pass`-th time, or null when
// the run is over.
export function nextStep(
  at: number,
  pass: number,
  length: number,
  plan: PlayPlan
): { at: number; pass: number } | null {
  if (pass < Math.max(1, Math.trunc(plan.repeat) || 1)) return { at, pass: pass + 1 };
  const next = at + 1;
  if (plan.loop) {
    const { from, to } = clampRange(plan.from, plan.to, length);
    if (to < from) return null; // an empty list has nothing to loop
    return { at: next > to ? from : next, pass: 1 };
  }
  return next < length ? { at: next, pass: 1 } : null;
}
