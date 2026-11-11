import type { IDisposable, IEvent } from './interfaces';

export class EventEmitter<T> {
  private listeners: Array<(arg: T) => void> = [];

  /** Whether anyone is subscribed; lets callers skip preparing an argument nobody reads. */
  get hasListeners(): boolean {
    return this.listeners.length > 0;
  }

  fire(arg: T): void {
    // Iterate a snapshot so a listener that disposes itself (or another
    // listener) mid-delivery doesn't shift the array under the loop.
    for (const listener of [...this.listeners]) {
      listener(arg);
    }
  }

  event: IEvent<T> = (listener) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };

  dispose(): void {
    this.listeners = [];
  }
}
