/**
 * FullTime API Server — Exposes TxLINE fixture/score data to frontend
 *
 * Port 3001: REST API
 *   GET /api/fixtures     → TxLINE fixtures snapshot
 *   GET /api/scores/:id   → TxLINE scores for a fixture
 */

import express from "express";
import cors from "cors";
import { TxLineClient } from "./txline-client";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const PORT = parseInt(process.env.API_PORT || "3001");
const NETWORK = (process.env.TXLINE_NETWORK || "devnet") as "devnet" | "mainnet";
const API_ORIGIN = NETWORK === "mainnet" ? "https://txline.txodds.com" : "https://txline-dev.txodds.com";

const app = express();
app.use(cors());
app.use(express.json());

let txline: TxLineClient | null = null;

async function getClient(): Promise<TxLineClient> {
  if (!txline) {
    txline = new TxLineClient(NETWORK);
    console.log("[API] Authenticating with TxLINE...");
    await txline.authenticate();
    console.log("[API] TxLINE auth successful");
  }
  return txline;
}

app.post("/auth/guest/start", async (_req, res) => {
  try {
    const r = await axios.post(`${API_ORIGIN}/auth/guest/start`);
    res.json(r.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.use("/api", async (req, res) => {
  try {
    const client = await getClient();
    const http = client.getHttpClient();
    if (!http) return res.status(500).json({ error: "Not authenticated" });
    const result = await http.get(req.originalUrl);
    res.json(result.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", network: NETWORK, authenticated: txline !== null });
});

app.listen(PORT, () => {
  console.log(`[API] TxLINE proxy running on http://localhost:${PORT}`);
});
