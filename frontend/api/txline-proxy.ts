import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const targetPath = (req.query.proxy as string) || "";
  const targetUrl = `https://txline-dev.txodds.com/${targetPath}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
  if (req.headers["x-api-token"]) headers["X-Api-Token"] = String(req.headers["x-api-token"]);

  fetch(targetUrl, {
    method: req.method || "GET",
    headers,
    body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
  }).then(async (upstream) => {
    const text = await upstream.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.status(upstream.status).send(text);
  }).catch((err: any) => {
    res.status(500).json({ error: String(err.message) });
  });
}
