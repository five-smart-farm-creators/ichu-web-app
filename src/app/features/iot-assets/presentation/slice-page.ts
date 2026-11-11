/** Returns one page of an in-memory list; the page size and index come from the paginator. */
export function slicePage<T>(items: readonly T[], pageIndex: number, pageSize: number): readonly T[] {
  return items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
}
