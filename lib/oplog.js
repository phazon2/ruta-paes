// Agent-ops log persistente: appendea cada run como JSONL a la branch "logs" del
// repo via GitHub API (corre en Vercel, que sí tiene egress libre).
// Fail-safe: si no hay PAT o falla la API, el fulfillment NUNCA se rompe.

const REPO = "phazon2/ruta-paes";
const BRANCH = "logs";

export async function logRun(entry) {
  const token = process.env.GITHUB_PAT;
  if (!token) return { ok: false, reason: "sin GITHUB_PAT (solo console log)" };

  const day = new Date().toISOString().slice(0, 10);
  const path = `logs/runs-${day}.jsonl`;
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  let sha;
  let current = "";
  const getRes = await fetch(`${url}?ref=${BRANCH}`, { headers });
  if (getRes.status === 200) {
    const j = await getRes.json();
    sha = j.sha;
    current = Buffer.from(j.content || "", "base64").toString("utf8");
  }

  const body = {
    message: `oplog: ${entry.type} ${entry.runId || ""}`.trim(),
    branch: BRANCH,
    content: Buffer.from(current + JSON.stringify(entry) + "\n", "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
  return { ok: putRes.ok, status: putRes.status };
}
