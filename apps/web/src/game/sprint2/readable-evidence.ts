/** PIC D presentation-evidence rules. These flags are local reading progress, never mastery or scoring. */
export function recordPage(viewed: readonly number[], page: number, pageCount: number): number[] {
 if (!Number.isInteger(page) || page < 0 || page >= pageCount) return [...viewed];
 return [...new Set([...viewed, page])].sort((a,b)=>a-b);
}
export function readingComplete(pageCount: number, viewed: readonly number[]): boolean {
 return Number.isInteger(pageCount) && pageCount > 0 &&
  Array.from({length:pageCount},(_,index)=>index).every(index=>viewed.includes(index));
}
/** C04 public documents are marked viewed only on closing their last page. */
export function canRecordDocument(pageIndex: number, lastPageIndex: number): boolean {
 return Number.isInteger(pageIndex) && Number.isInteger(lastPageIndex) && lastPageIndex >= 1 && pageIndex >= lastPageIndex;
}
