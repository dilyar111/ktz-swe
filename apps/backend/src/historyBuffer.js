/**
 * In-memory ring buffer for telemetry snapshots (replay / last N minutes).
 * Not persistent — replace with Redis/DB when needed.
 */

class HistoryBuffer {
  /**
   * @param {{ maxMs?: number, maxEntries?: number }} opts
   */
  constructor(opts = {}) {
    this.maxMs = opts.maxMs ?? 15 * 60 * 1000;
    this.maxEntries = opts.maxEntries ?? 50000;
    /** @type {Array<{ ts: number, payload: object }>} */
    this.entries = [];
  }

  push(ts, payload) {
    this.entries.push({ ts, payload });
    const cutoff = ts - this.maxMs;
    while (this.entries.length && this.entries[0].ts < cutoff) {
      this.entries.shift();
    }
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getRange(fromTs, toTs) {
    return this.entries.filter((e) => e.ts >= fromTs && e.ts <= toTs);
  }

  snapshot() {
    return [...this.entries];
  }
}

module.exports = { HistoryBuffer };
