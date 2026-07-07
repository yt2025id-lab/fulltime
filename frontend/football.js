export default async function handler(request) {
  const url = new URL(request.url);
  const apiPath = url.searchParams.get("path") || "";
  const apiUrl = `https://api.football-data.org/v4${apiPath}`;

  try {
    const res = await fetch(apiUrl, {
      headers: { "X-Auth-Token": "2c71ce778f0c41049706f298351f207d" },
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Proxy failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config = { runtime: "edge" };
