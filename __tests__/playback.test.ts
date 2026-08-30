import { clampRange, nextStep, startAt, type PlayPlan } from '../src/lib/playback';

const plan = (over: Partial<PlayPlan> = {}): PlayPlan => ({
  example: true,
  chinese: false,
  repeat: 1,
  loop: false,
  from: 0,
  to: 0,
  ...over,
});

describe('clampRange', () => {
  it('reads blank boxes as the whole list', () => {
    expect(clampRange(0, 0, 10)).toEqual({ from: 0, to: 9 });
  });

  it('turns what was typed into indexes, 1-based to 0-based', () => {
    expect(clampRange(3, 5, 10)).toEqual({ from: 2, to: 4 });
  });

  it('pulls numbers past the end back onto the list', () => {
    expect(clampRange(99, 400, 10)).toEqual({ from: 9, to: 9 });
  });

  it('still gives a range when the two ends are typed backwards', () => {
    expect(clampRange(8, 2, 10)).toEqual({ from: 1, to: 7 });
  });
});

describe('nextStep', () => {
  it('walks to the end and then stops', () => {
    expect(nextStep(0, 1, 3, plan())).toEqual({ at: 1, pass: 1 });
    expect(nextStep(2, 1, 3, plan())).toBeNull();
  });

  it('reads the same word again until its repeats are used up', () => {
    const twice = plan({ repeat: 2 });
    expect(nextStep(0, 1, 3, twice)).toEqual({ at: 0, pass: 2 });
    expect(nextStep(0, 2, 3, twice)).toEqual({ at: 1, pass: 1 });
  });

  it('wraps back to the start of the range instead of stopping', () => {
    const loop = plan({ loop: true, from: 2, to: 4 });
    expect(nextStep(3, 1, 10, loop)).toEqual({ at: 1, pass: 1 }); // index 3 is the 4th word
    expect(nextStep(1, 1, 10, loop)).toEqual({ at: 2, pass: 1 });
  });

  it('repeats each word inside a loop, not just the range', () => {
    const loop = plan({ loop: true, repeat: 2, from: 1, to: 2 });
    expect(nextStep(1, 1, 10, loop)).toEqual({ at: 1, pass: 2 });
    expect(nextStep(1, 2, 10, loop)).toEqual({ at: 0, pass: 1 });
  });

  it('has nothing to loop when the search left no words', () => {
    expect(nextStep(0, 1, 0, plan({ loop: true }))).toBeNull();
  });
});

describe('startAt', () => {
  it('joins the range at its start when play begins outside it', () => {
    expect(startAt(0, 10, plan({ loop: true, from: 4, to: 6 }))).toBe(3);
  });

  it('carries on from where the reader already is, inside the range', () => {
    expect(startAt(4, 10, plan({ loop: true, from: 4, to: 6 }))).toBe(4);
  });

  it('leaves the position alone when nothing is looping', () => {
    expect(startAt(7, 10, plan())).toBe(7);
  });
});
