/** Batch operations on objects into groups of `minimumBatchSize`
 * provided to the constructor's callback.
 *
 * Call `do` or `doAll` to enqueue items, don't forget to:
 * - call flush after all items are enqueued
 * - await all the methods (do* and flush)
 *
 * The callback can be called with more than `minimumBatchSize`
 * when `doAll` is used - see note on that method.
 */
export default class BufferedAction<T> {
  // TODO: low and high marks
  private buffer: T[] = [];
  constructor(
    private readonly minimumBatchSize: number,
    private readonly action: (items: T[]) => Promise<void>,
  ) {}
  /** Call to empty all items by calling the callback with all items if at least one is queued */
  public async flush() {
    const buffer = this.buffer;
    if (!buffer.length) return 0;
    this.buffer = new Array(this.minimumBatchSize);
    this.action(buffer);
    return buffer.length;
  }
  private async flushIfShould() {
    return this.buffer.length >= this.minimumBatchSize ? await this.flush() : 0;
  }
  /** Enqueue a single item to process in the batch later. Returns items actually processed. */
  public async do(item: T) {
    this.buffer.push(item);
    return await this.flushIfShould();
  }
  /** Enqueue an array of items to process in the batch later.
   * If the additional items goes beyond `minimumBatchSize`,
   * all items will be flushed at once, however many was added
   * by `doAll`.
   * Returns items actually processed. */
  public async doAll(items: T[]) {
    this.buffer = this.buffer.concat(items);
    return await this.flushIfShould();
  }
}
