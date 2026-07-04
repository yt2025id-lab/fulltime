/**
 * Proof Fetcher — fetch + transform TxLINE stat-validation data ke format CPI
 *
 * Membuat 2 panggilan stat-validation:
 *   1. statKey=1 → HOME goals (Participant 1)
 *   2. statKey=2 → AWAY goals (Participant 2)
 *
 * TxLINE API mengembalikan data dalam format number[] (raw bytes)
 * → cocok dengan tipe `[u8; 32]` di Rust.
 *
 * Prasyarat: TxLineClient harus sudah diautentikasi.
 */

import { TxLineClient } from "./txline-client";
import { PublicKey } from "@solana/web3.js";

// ─── Contract Type Mappings ───────────────────────────────────────
export interface ContractProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export interface ContractScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ContractStatTerm {
  statToProve: ContractScoreStat;
  eventStatRoot: number[];
  statProof: ContractProofNode[];
}

export interface ContractScoresUpdateStats {
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
}

export interface ContractScoresBatchSummary {
  fixtureId: number;
  updateStats: ContractScoresUpdateStats;
  eventsSubTreeRoot: number[];
}

export interface SettlementProofData {
  targetTs: number; // milliseconds
  fixtureSummary: ContractScoresBatchSummary;
  fixtureProof: ContractProofNode[];
  mainTreeProof: ContractProofNode[];
  statA: ContractStatTerm;
  statB: ContractStatTerm;
}

// ─── Proof Fetcher ─────────────────────────────────────────────────

export class ProofFetcher {
  private txline: TxLineClient;

  constructor(txline: TxLineClient) {
    this.txline = txline;
  }

  /**
   * Fetch settlement proof untuk satu fixture.
   * Membuat 2 panggilan API (statKey=1 & statKey=2), merge hasilnya.
   */
  async fetchSettlementProof(
    fixtureId: number
  ): Promise<SettlementProofData | null> {
    console.log(
      `[Proof] Fetching proofs for fixture #${fixtureId}`
    );

    try {
      // Cari seq yang tepat melalui scores snapshot
      const scores = await this.txline.getScoresSnapshot(fixtureId);
      const seq = scores?.length ?? 1;

      // Fetch stat validation untuk HOME goals (key=1)
      const v1 = await this.txline.getStatValidation({
        fixtureId,
        seq,
        statKey: 1,
      });

      // Fetch stat validation untuk AWAY goals (key=2)
      const v2 = await this.txline.getStatValidation({
        fixtureId,
        seq,
        statKey: 2,
      });

      if (!v1?.summary?.fixtureId) {
        console.log(`[Proof] No validation data for fixture #${fixtureId}`);
        return null;
      }

      // TxLINE API mengembalikan number[] untuk byte arrays — tidak perlu konversi
      return {
        targetTs: v1.summary.updateStats.minTimestamp,

        fixtureSummary: {
          fixtureId: v1.summary.fixtureId,
          updateStats: {
            updateCount: v1.summary.updateStats.updateCount,
            minTimestamp: v1.summary.updateStats.minTimestamp,
            maxTimestamp: v1.summary.updateStats.maxTimestamp,
          },
          eventsSubTreeRoot:
            v1.summary.eventStatsSubTreeRoot,
        },

        fixtureProof: (v1.subTreeProof || []).map(
          (n: any) => ({
            hash: n.hash,
            isRightSibling: n.isRightSibling,
          })
        ),
        mainTreeProof: (v1.mainTreeProof || []).map(
          (n: any) => ({
            hash: n.hash,
            isRightSibling: n.isRightSibling,
          })
        ),

        statA: {
          statToProve: {
            key: v1.statToProve?.key ?? 1,
            value: v1.statToProve?.value ?? 0,
            period: v1.statToProve?.period ?? 0,
          },
          eventStatRoot: v1.eventStatRoot,
          statProof: (v1.statProof || []).map(
            (n: any) => ({
              hash: n.hash,
              isRightSibling: n.isRightSibling,
            })
          ),
        },

        statB: {
          statToProve: {
            key: v2?.statToProve?.key ?? 2,
            value: v2?.statToProve?.value ?? 0,
            period: v2?.statToProve?.period ?? 0,
          },
          eventStatRoot: v2?.eventStatRoot || [],
          statProof: (v2?.statProof || []).map(
            (n: any) => ({
              hash: n.hash,
              isRightSibling: n.isRightSibling,
            })
          ),
        },
      };
    } catch (err: any) {
      console.error(
        `[Proof] Failed for fixture #${fixtureId}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Derive daily_scores_roots PDA dari TxLINE program.
   * targetTs dalam milliseconds → convert ke epoch_day.
   */
  static deriveDailyScoresPda(
    targetTs: number,
    txlineProgramId: string
  ): { pda: string; epochDay: number } {
    const epochDay = Math.floor(
      targetTs / (24 * 60 * 60 * 1000)
    );

    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("daily_scores_roots"),
        Buffer.from(
          new Uint8Array(new Uint16Array([epochDay]).buffer)
        ),
      ],
      new PublicKey(txlineProgramId)
    );

    return { pda: pda.toBase58(), epochDay };
  }
}
