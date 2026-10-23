import { describe, expect, it, vi } from 'vitest';
import ReaderSession from '../../js/reader-session.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ReaderSession', () => {
  it('ignores a procedure completion after the reader is left', async () => {
    const request = deferred();
    const events = [];
    const session = ReaderSession.create({
      load: vi.fn(() => request.promise),
      onStateChange: event => events.push(event.type)
    });

    const transition = session.transition({ type: 'procedure', id: 'a' });
    session.transition({ type: 'leave' });
    request.resolve({ id: 'a', steps: [] });

    await transition;

    expect(events).toEqual(['loading', 'leave']);
    expect(session.getState()).toEqual({ status: 'idle', target: null });
  });

  it('ignores a procedure failure after the reader is left', async () => {
    const request = deferred();
    const events = [];
    const session = ReaderSession.create({
      load: vi.fn(() => request.promise),
      onStateChange: event => events.push(event.type)
    });

    const transition = session.transition({ type: 'procedure', id: 'a' });
    session.transition({ type: 'leave' });
    request.reject(new Error('late failure'));

    await transition;

    expect(events).toEqual(['loading', 'leave']);
    expect(session.getState()).toEqual({ status: 'idle', target: null });
  });

  it('commits only the newest procedure when completions arrive out of order', async () => {
    const requests = { a: deferred(), b: deferred() };
    const events = [];
    const session = ReaderSession.create({
      load: vi.fn(id => requests[id].promise),
      onStateChange: event => events.push(event)
    });

    const a = session.transition({ type: 'procedure', id: 'a' });
    const b = session.transition({ type: 'procedure', id: 'b' });
    requests.a.resolve({ id: 'a' });
    requests.b.resolve({ id: 'b' });

    await Promise.all([a, b]);

    expect(events.filter(event => event.type === 'active')).toEqual([
      { type: 'active', target: { type: 'procedure', id: 'b' }, data: { id: 'b' } }
    ]);
    expect(session.getState()).toEqual({
      status: 'active',
      target: { type: 'procedure', id: 'b' }
    });
  });

  it('does not reload an active or loading target unless forced', async () => {
    const request = deferred();
    const load = vi.fn(() => request.promise);
    const session = ReaderSession.create({ load });

    const first = session.transition({ type: 'procedure', id: 'a' });
    const duplicate = session.transition({ type: 'procedure', id: 'a' });

    expect(duplicate).toBe(first);
    expect(load).not.toHaveBeenCalled();

    request.resolve({ id: 'a' });
    await first;
    await session.transition({ type: 'procedure', id: 'a' }, { force: true });

    expect(load).toHaveBeenCalledTimes(2);
  });
});
