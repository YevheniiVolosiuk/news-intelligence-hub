/** Injectable clock seam so tests can control time deterministically. */
export const CLOCK = Symbol('CLOCK');
export type Clock = () => Date;
