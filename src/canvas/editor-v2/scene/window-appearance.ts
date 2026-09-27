export const WINDOW_GLASS_COLOR = '#c0d4d5';
export const WINDOW_SEAL_COLOR = '#485254';

/** A narrow gasket reads at both facade and interior scale without changing the opening. */
export const windowSealWidth = (frameMm: number) => Math.min(9, Math.max(4, frameMm * .18));
