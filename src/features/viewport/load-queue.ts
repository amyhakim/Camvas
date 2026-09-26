/** Limit simultaneous model downloads/decodes; queued work is cancelled on viewport teardown. */
export class LoadQueue {
  private running = 0;
  private waiting: { start: () => void; cancel: () => void }[] = [];
  private closed = false;
  constructor(private concurrency = 2) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cancel = () => reject(new DOMException('Viewport closed', 'AbortError'));
      const start = () => {
        this.running++;
        void Promise.resolve().then(work).then(resolve, reject).finally(() => {
          this.running--;
          if (!this.closed) this.waiting.shift()?.start();
        });
      };
      if (this.closed) cancel();
      else if (this.running < this.concurrency) start();
      else this.waiting.push({ start, cancel });
    });
  }
  close() { this.closed = true; this.waiting.splice(0).forEach(job => job.cancel()); }
}
