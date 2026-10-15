// Upstash Redis через REST: без зависимостей, переменные создаёт интеграция в Vercel.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export async function pipeline(commands) {
  const res = await fetch(`${URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

// Дата по Бишкеку (UTC+6).
export const day = (d = new Date()) => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);
