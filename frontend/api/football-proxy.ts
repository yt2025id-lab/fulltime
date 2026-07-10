import type { VercelRequest, VercelResponse } from "@vercel/node";

const FD_BASE = "https://api.football-data.org/v4";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.VITE_FOOTBALL_API_KEY || "";
  const path = (req.query.path as string) || "";

  const qs = Object.entries(req.query)
    .filter(([k]) => k !== "path")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

  const targetUrl = `${FD_BASE}/${path}${qs ? "?" + qs : ""}`;

  fetch(targetUrl, {
    method: req.method || "GET",
    headers: {
      "X-Auth-Token": apiKey,
      "Content-Type": "application/json",
    },
  })
    .then(async (upstream) => {
      const text = await upstream.text();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.status(upstream.status).send(text);
    })
    .catch((err: any) => {
      res.status(500).json({ error: String(err.message) });
    });
}
