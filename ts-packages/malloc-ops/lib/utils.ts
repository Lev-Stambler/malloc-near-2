// TODO: tests here
/**
 * Scan an array of numbers in O(n) time and have it be non-inclusive.
 * I.e. the first element is 0
 */
export const scanlAccum = (inp: number[]): number[] => {
  let sums: number[] = [];
  // Alas a perfect opportunity for Scan, but it is not built into JS :(
  for (let i = 0; i < inp.length; i++) {
    if (i === 0) sums.push(0);
    else sums.push(sums[i - 1] + inp[i - 1]);
  }
	return sums
};
