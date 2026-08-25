import { calm, type Theme } from '../theme';

// There is one palette. These stayed as hooks rather than becoming a plain
// import because every screen calls useStyles(makeStyles), and a second look
// would come back as a context here rather than as a rewrite of every screen.
export function useTheme(): Theme {
  return calm;
}

// Built once per stylesheet and kept, so a re-render does not rebuild styles.
const cache = new WeakMap<object, unknown>();

export function useStyles<T>(make: (t: Theme) => T): T {
  let built = cache.get(make);
  if (!built) {
    built = make(calm) as unknown;
    cache.set(make, built);
  }
  return built as T;
}
