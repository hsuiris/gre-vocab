// How the word-list player walks the list: how many times each word is read,
// and whether it wraps round a chosen handful of words instead of running to
// the end. Kept here as plain arithmetic so it can be tested without a speech
// engine.

export type PlayPlan = {
  example: boolean; // read the example sentence after the word
  chinese: boolean; // read the meaning, and the translated example
  repeat: number; // times each word is read before moving on
  loop: boolean;
  // Which positions in the visible list the loop walks, in list order.
  // null means nothing was ticked, so it walks everything on screen.
  // [] means what was ticked is not on screen, and there is nothing to play.
  ring: number[] | null;
};

const repeatsOf = (plan: PlayPlan) => Math.max(1, Math.trunc(plan.repeat) || 1);

// Where pressing play should start. Outside the ticked words there is nothing
// to wrap round, so playback joins the ring at the next word it comes to.
export function startAt(at: number, length: number, plan: PlayPlan): number {
  if (!plan.loop) return at;
  if (plan.ring === null) return at < length ? at : 0;
  if (plan.ring.includes(at)) return at;
  return plan.ring.find((i) => i > at) ?? plan.ring[0] ?? -1;
}

// What comes after finishing reading `at` for the `pass`-th time, or null when
// the run is over.
export function nextStep(
  at: number,
  pass: number,
  length: number,
  plan: PlayPlan
): { at: number; pass: number } | null {
  if (pass < repeatsOf(plan)) return { at, pass: pass + 1 };
  const next = at + 1;
  if (!plan.loop) return next < length ? { at: next, pass: 1 } : null;
  if (plan.ring === null) return length > 0 ? { at: next < length ? next : 0, pass: 1 } : null;
  // Back to the first ticked word once past the last one.
  const to = plan.ring.find((i) => i >= next) ?? plan.ring[0];
  return to === undefined ? null : { at: to, pass: 1 };
}
