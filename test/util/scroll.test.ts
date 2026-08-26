import { scrollOffsetToReveal } from '../../src/util/scroll';

describe('scrollOffsetToReveal', () => {
  it('returns null when the target is already fully within the viewport', () => {
    expect(scrollOffsetToReveal(100, 150, 250, 400)).toBeNull();
  });

  it('scrolls back to targetStart when the target starts before the current offset', () => {
    expect(scrollOffsetToReveal(200, 50, 150, 300)).toBe(50);
  });

  it('scrolls forward so targetEnd aligns with the trailing edge when the target ends past the viewport', () => {
    // viewport [0, 300); target [250, 500) - scroll so 500 lands at the trailing edge: 500 - 300 = 200
    expect(scrollOffsetToReveal(0, 250, 500, 300)).toBe(200);
  });

  it('treats an exact viewport-edge match as already visible', () => {
    expect(scrollOffsetToReveal(0, 0, 300, 300)).toBeNull();
  });

  it('aligns to the trailing edge when the target is wider than the viewport and extends past it', () => {
    expect(scrollOffsetToReveal(0, 100, 1000, 300)).toBe(700);
  });
});
