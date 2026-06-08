import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatManager } from './heartbeat.js';
/** Create a mock WebSocket that captures sent text into an external array. */
function createMockSocket(sent) {
    const listeners = {};
    const mock = {
        readyState: 1,
        send(data) { sent.push(data); },
        on(event, fn) {
            (listeners[event] ??= []).push(fn);
        },
        once(event, fn) {
            (listeners[event] ??= []).push(fn);
        },
        emit(event, ...args) {
            listeners[event]?.forEach(fn => fn(...args));
        },
        removeAllListeners() {
            Object.keys(listeners).forEach(k => delete listeners[k]);
        },
    };
    return mock;
}
describe('HeartbeatManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it('initializes with default config', () => {
        const hm = new HeartbeatManager();
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        vi.advanceTimersByTime(15000);
        expect(sent.length).toBe(1);
        const msg = JSON.parse(sent[0]);
        expect(msg.event).toBe('HEARTBEAT');
        hm.stop();
    });
    it('accepts custom config overrides', () => {
        const hm = new HeartbeatManager({ intervalMs: 5000, ackTimeoutMs: 2000, maxMissedAcks: 3 });
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        vi.advanceTimersByTime(5000);
        expect(sent.length).toBe(1);
        hm.stop();
    });
    it('addNode() starts tracking a socket', () => {
        const hm = new HeartbeatManager();
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        vi.advanceTimersByTime(15000);
        expect(sent.length).toBe(1);
        hm.stop();
    });
    it('removeNode() stops tracking', () => {
        const hm = new HeartbeatManager();
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        hm.removeNode('node-1');
        vi.advanceTimersByTime(15000);
        expect(sent.length).toBe(0);
        hm.stop();
    });
    it('handleAck() resets missedAcks to zero', () => {
        const hm = new HeartbeatManager({ intervalMs: 5000, ackTimeoutMs: 1000, maxMissedAcks: 2 });
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        vi.advanceTimersByTime(5000);
        expect(sent.length).toBe(1);
        hm.handleAck('node-1');
        const timeoutFn = vi.fn();
        hm.on('node_timeout', timeoutFn);
        vi.advanceTimersByTime(1000);
        expect(timeoutFn).not.toHaveBeenCalled();
        hm.stop();
    });
    it('emits node_timeout after maxMissedAcks consecutive misses', () => {
        const hm = new HeartbeatManager({ intervalMs: 10000, ackTimeoutMs: 1000, maxMissedAcks: 2 });
        const timeoutFn = vi.fn();
        hm.on('node_timeout', timeoutFn);
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        // 1st miss
        vi.advanceTimersByTime(10000 + 1000);
        // 2nd miss
        vi.advanceTimersByTime(10000 + 1000);
        expect(timeoutFn).toHaveBeenCalledWith({ socketId: 'node-1' });
        hm.stop();
    });
    it('ACK after 1 missed ping resets counter', () => {
        const hm = new HeartbeatManager({ intervalMs: 5000, ackTimeoutMs: 1000, maxMissedAcks: 2 });
        const timeoutFn = vi.fn();
        hm.on('node_timeout', timeoutFn);
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        // Miss first ping
        vi.advanceTimersByTime(5000 + 1000);
        // Second ping - ACK it
        vi.advanceTimersByTime(5000);
        hm.handleAck('node-1');
        vi.advanceTimersByTime(1000);
        expect(timeoutFn).not.toHaveBeenCalled();
        // Now miss two more
        vi.advanceTimersByTime(5000 + 1000); // miss 1
        vi.advanceTimersByTime(5000 + 1000); // miss 2
        expect(timeoutFn).toHaveBeenCalledWith({ socketId: 'node-1' });
        hm.stop();
    });
    it('stop() halts the interval', () => {
        const hm = new HeartbeatManager({ intervalMs: 5000, ackTimeoutMs: 1000, maxMissedAcks: 2 });
        const sent = [];
        const sock = createMockSocket(sent);
        hm.addNode('node-1', sock);
        hm.start();
        vi.advanceTimersByTime(5000);
        expect(sent.length).toBe(1);
        hm.stop();
        vi.advanceTimersByTime(30000);
        expect(sent.length).toBe(1);
        hm.start();
        vi.advanceTimersByTime(5000);
        expect(sent.length).toBe(2);
        hm.stop();
    });
});
