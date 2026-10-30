/*
 * Reader transition coordinator.
 *
 * The browser app loads this file as a classic script, while unit tests load
 * it through CommonJS. Keeping the module boundary small makes route races
 * testable without coupling tests to the DOM renderer.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.ReaderSession = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function targetKey(target) {
    return target.type + ':' + target.id;
  }

  function sameTarget(a, b) {
    return !!a && !!b && targetKey(a) === targetKey(b);
  }

  function create(options) {
    options = options || {};
    if (typeof options.load !== 'function') throw new TypeError('ReaderSession requires a load function');

    var sequence = 0;
    var current = { status: 'idle', target: null, promise: null };

    function emit(event) {
      if (typeof options.onStateChange === 'function') options.onStateChange(event);
    }

    function isCurrent(token, target) {
      return token === sequence && current.status === 'loading' && sameTarget(current.target, target);
    }

    function leave() {
      sequence += 1;
      current = { status: 'idle', target: null, promise: null };
      emit({ type: 'leave' });
      return Promise.resolve({ status: 'idle' });
    }

    function transition(target, opts) {
      opts = opts || {};
      if (!target || target.type === 'leave') return leave();
      if (target.type !== 'procedure' || !target.id) {
        return Promise.reject(new TypeError('ReaderSession target must be a procedure or leave'));
      }

      if (!opts.force && sameTarget(current.target, target) &&
          (current.status === 'loading' || current.status === 'active')) {
        return current.promise || Promise.resolve({ status: current.status, reused: true });
      }

      var token = ++sequence;
      var nextTarget = { type: 'procedure', id: target.id };
      current = { status: 'loading', target: nextTarget, promise: null };
      emit({ type: 'loading', target: nextTarget });

      var promise = Promise.resolve()
        .then(function () { return options.load(nextTarget.id); })
        .then(function (data) {
          if (!isCurrent(token, nextTarget)) return { status: 'stale' };
          current = { status: 'active', target: nextTarget, promise: null };
          emit({ type: 'active', target: nextTarget, data: data });
          return { status: 'active', target: nextTarget, data: data };
        })
        .catch(function (error) {
          if (!isCurrent(token, nextTarget)) return { status: 'stale' };
          current = { status: 'error', target: nextTarget, promise: null };
          emit({ type: 'error', target: nextTarget, error: error });
          return { status: 'error', target: nextTarget, error: error };
        });

      current.promise = promise;
      return promise;
    }

    return {
      transition: transition,
      getState: function () {
        return { status: current.status, target: current.target };
      }
    };
  }

  return { create: create };
}));
