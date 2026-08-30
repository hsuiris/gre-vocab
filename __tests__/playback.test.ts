import { nextStep, startAt, type PlayPlan } from '../src/lib/playback';

const plan = (over: Partial<PlayPlan> = {}): PlayPlan => ({
  example: true,
  chinese: false,
  repeat: 1,
  loop: false,
  ring: null,
  ...over,
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

  it('wraps round the whole list when nothing is ticked', () => {
    const loop = plan({ loop: true });
    expect(nextStep(1, 1, 3, loop)).toEqual({ at: 2, pass: 1 });
    expect(nextStep(2, 1, 3, loop)).toEqual({ at: 0, pass: 1 });
  });

  it('skips straight to the next ticked word', () => {
    const loop = plan({ loop: true, ring: [1, 5, 8] });
    expect(nextStep(1, 1, 20, loop)).toEqual({ at: 5, pass: 1 });
    expect(nextStep(8, 1, 20, loop)).toEqual({ at: 1, pass: 1 }); // back to the first
  });

  it('repeats each ticked word, not just the round', () => {
    const loop = plan({ loop: true, repeat: 2, ring: [1, 5] });
    expect(nextStep(1, 1, 20, loop)).toEqual({ at: 1, pass: 2 });
    expect(nextStep(1, 2, 20, loop)).toEqual({ at: 5, pass: 1 });
  });

  it('stops when the ticked words are all filtered off the screen', () => {
    expect(nextStep(0, 1, 20, plan({ loop: true, ring: [] }))).toBeNull();
  });

  it('has nothing to loop when the search left no words', () => {
    expect(nextStep(0, 1, 0, plan({ loop: true }))).toBeNull();
  });
});

describe('startAt', () => {
  it('joins the ring at the next ticked word below it', () => {
    expect(startAt(3, 20, plan({ loop: true, ring: [1, 5, 8] }))).toBe(5);
  });

  it('goes back to the first ticked word when play starts past the last', () => {
    expect(startAt(12, 20, plan({ loop: true, ring: [1, 5, 8] }))).toBe(1);
  });

  it('carries on from a word that is itself ticked', () => {
    expect(startAt(5, 20, plan({ loop: true, ring: [1, 5, 8] }))).toBe(5);
  });

  it('has nowhere to start when nothing ticked is on screen', () => {
    expect(startAt(0, 20, plan({ loop: true, ring: [] }))).toBe(-1);
  });

  it('leaves the position alone when nothing is looping', () => {
    expect(startAt(7, 20, plan())).toBe(7);
  });
});
