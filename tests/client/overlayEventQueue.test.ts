import { describe, expect, it } from 'vitest';
import { SequentialEventQueue } from '../../src/client/overlay/eventQueue';

describe('SequentialEventQueue', () => {
  it('keeps the current event active and releases later events in arrival order', () => {
    const queue = new SequentialEventQueue<string>();

    expect(queue.enqueue('first')).toBe('first');
    expect(queue.enqueue('second')).toBeNull();
    expect(queue.enqueue('third')).toBeNull();
    expect(queue.pendingCount).toBe(2);
    expect(queue.complete()).toBe('second');
    expect(queue.complete()).toBe('third');
    expect(queue.complete()).toBeNull();
  });

  it('clears the active event and every pending event', () => {
    const queue = new SequentialEventQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.clear();

    expect(queue.pendingCount).toBe(0);
    expect(queue.enqueue(3)).toBe(3);
  });
});
