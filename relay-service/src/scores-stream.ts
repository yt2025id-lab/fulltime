/**
 * SSE Stream Listener — real-time score updates dari TxLINE
 *
 * Subscribe ke /api/scores/stream untuk deteksi phase match secara real-time.
 * Fallback: polling jika SSE connection drop.
 *
 * Phase yang memicu settlement:
 *   5  (F)   — Full Time
 *   10 (FET) — Finished After Extra Time
 *   13 (FPE) — Finished After Penalties
 *
 * Phase yang memicu cancel:
 *   15 (A)  — Abandoned
 *   16 (C)  — Cancelled
 */

import { EventEmitter } from "events";

// ─── Constants ─────────────────────────────────────────────────────
const SETTLEMENT_PHASES = new Set([5, 10, 13]);
const CANCELLATION_PHASES = new Set([15, 16]);

// ─── Types ─────────────────────────────────────────────────────────
interface SseMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface ScoreEvent {
  fixtureId: number;
  phaseId: number;
  phaseName: string;
  seq: number;
  timestamp: number;
}

export interface MatchResult {
  fixtureId: number;
  action: "settle" | "cancel";
  phaseId: number;
  phaseName: string;
  timestamp: number;
}

// ─── SSE Parser ────────────────────────────────────────────────────
function parseSseBlock(block: string): SseMessage | null {
  const message: SseMessage = { data: "" };

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;

    const separatorIndex = rawLine.indexOf(":");
    const field =
      separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value =
      separatorIndex === -1
        ? ""
        : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }

  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

function parseSseData(data: string): any {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// ─── Game Phase Names ──────────────────────────────────────────────
const PHASE_NAMES: Record<number, string> = {
  1: "Not Started",
  2: "First Half",
  3: "Half Time",
  4: "Second Half",
  5: "Full Time",
  6: "Waiting Extra Time",
  7: "Extra Time 1H",
  8: "Extra Time HT",
  9: "Extra Time 2H",
  10: "Finished After ET",
  11: "Waiting Penalties",
  12: "Penalties",
  13: "Finished After Penalties",
  14: "Interrupted",
  15: "Abandoned",
  16: "Cancelled",
};

// ─── SSE Stream Class ──────────────────────────────────────────────
export class ScoresStream extends EventEmitter {
  private streamUrl: string;
  private headers: Record<string, string>;
  private seenFixtures: Map<number, number> = new Map();
  private running = false;
  private retryCount = 0;
  private maxRetries: number;
  private abortController: AbortController | null = null;

  constructor(
    streamUrl: string,
    jwt: string,
    apiToken: string,
    maxRetries = 10
  ) {
    super();
    this.streamUrl = streamUrl;
    this.maxRetries = maxRetries;
    this.headers = {
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(
      `[SSE] Connecting to scores stream: ${this.streamUrl}`
    );

    while (this.running && this.retryCount < this.maxRetries) {
      try {
        await this.connect();
        this.retryCount = 0;
      } catch (err: any) {
        if (!this.running) break;
        if (err.name === "AbortError") break;
        this.retryCount++;
        const delay = Math.min(1000 * 2 ** this.retryCount, 30000);
        console.error(
          `[SSE] Connection error (attempt ${this.retryCount}/${this.maxRetries}): ${err.message}. Retrying in ${delay}ms`
        );
        await this.sleep(delay);
      }
    }

    if (!this.running) {
      console.log("[SSE] Stream stopped");
    } else {
      console.error("[SSE] Max retries exceeded, switching to polling");
      this.emit("fallback");
    }
  }

  stop(): void {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ─── Private ─────────────────────────────────────────────────
  private async connect(): Promise<void> {
    this.abortController = new AbortController();
    const response = await fetch(this.streamUrl, {
      headers: this.headers,
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE stream failed: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    console.log("[SSE] Connected, listening for score events...");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let separator = buffer.match(/\r?\n\r?\n/);
        while (separator?.index !== undefined) {
          const block = buffer.slice(0, separator.index);
          buffer = buffer.slice(
            separator.index + separator[0].length
          );

          const message = parseSseBlock(block);
          if (message) this.handleMessage(message);

          separator = buffer.match(/\r?\n\r?\n/);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleMessage(message: SseMessage): void {
    const eventType = message.event || "message";
    const data = parseSseData(message.data);

    if (eventType === "error") {
      console.error("[SSE] Error event:", data);
      this.emit("error", data);
      return;
    }

    if (eventType === "keepalive" || eventType === "heartbeat") {
      return; // ignore keepalive
    }

    this.processScoreEvent(data);
  }

  private processScoreEvent(data: any): void {
    // TxLINE scores event structure: { FixtureId, GameState, seq, ts, ... } or { fixtureId, gameState, ... }
    const fixtureId = data?.FixtureId ?? data?.fixtureId ?? data?.fixture_id;
    let rawPhase = data?.GameState ?? data?.gameState ?? data?.phaseId ?? data?.phase_id ?? data?.state;
    const seq = data?.Seq ?? data?.seq ?? data?.sequence;
    const ts = data?.Ts ?? data?.ts ?? data?.timestamp ?? Date.now();

    if (!fixtureId || rawPhase === undefined || rawPhase === null) {
      console.debug("[SSE] Unknown event format:", JSON.stringify(data).slice(0, 200));
      return;
    }

    // Phase can be string ("scheduled", "playing") or number (1, 2, 5...)
    let phaseId: number;
    if (typeof rawPhase === "string") {
      const phaseMap: Record<string, number> = {
        scheduled: 1, playing: 2, halftime: 4, paused: 3,
        finished: 5, cancelled: 16, abandoned: 15,
        aet: 7, ap: 12, postponed: 1,
      };
      phaseId = phaseMap[rawPhase.toLowerCase()] ?? 1;
    } else {
      phaseId = Number(rawPhase);
    }

    const prevPhase = this.seenFixtures.get(fixtureId);
    if (prevPhase === phaseId) return;
    this.seenFixtures.set(fixtureId, phaseId);

    const phaseName = PHASE_NAMES[phaseId] ?? rawPhase ?? `Phase ${phaseId}`;
    console.log(
      `[SSE] ⚽ Fixture #${fixtureId} → ${phaseName} (seq=${seq})`
    );

    const event: ScoreEvent = { fixtureId, phaseId, phaseName, seq, timestamp: ts };
    this.emit("score", event);

    if (SETTLEMENT_PHASES.has(phaseId)) {
      console.log(`[SSE] 🏁 Fixture #${fixtureId} ready for SETTLEMENT`);
      this.emit("settle", {
        fixtureId,
        action: "settle" as const,
        phaseId,
        phaseName,
        timestamp: ts,
      });
    } else if (CANCELLATION_PHASES.has(phaseId)) {
      console.log(`[SSE] ❌ Fixture #${fixtureId} CANCELLED`);
      this.emit("cancel", {
        fixtureId,
        action: "cancel" as const,
        phaseId,
        phaseName,
        timestamp: ts,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
