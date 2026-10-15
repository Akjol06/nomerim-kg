import { timingSafeEqual } from 'node:crypto';
import { pipeline, day } from './_redis.mjs';

const FIELDS = [['visitors', 'Посетители'], ['visits', 'Заходы'], ['filled', 'Заполнили номер'], ['downloads', 'Скачали PNG']];
const TYPES = { standard: 'Обычный', named: 'Именной' };
const REGIONS = { '01': 'г. Бишкек', '02': 'г. Ош', '03': 'Баткен', '04': 'Джалал-Абад', '05': 'Нарын', '06': 'Ош обл.', '07': 'Талас', '08': 'Чуй', '09': 'Иссык-Куль' };

const same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function authorized(request) {
  const { STATS_USER, STATS_PASSWORD } = process.env;
  if (!STATS_USER || !STATS_PASSWORD) return false;
  const [scheme, encoded] = (request.headers.get('authorization') || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString();
  const i = decoded.indexOf(':');
  return i > 0 && same(decoded.slice(0, i), STATS_USER) && same(decoded.slice(i + 1), STATS_PASSWORD);
}

const toObj = (arr) => {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]);
  return o;
};
const PARTNER = 'softech.kg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v) => (v || 0).toLocaleString('ru-RU');

export async function GET(request) {
  if (!authorized(request)) {
    return new Response('Нужен вход', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="nomerim stats", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const days = Array.from({ length: 14 }, (_, i) => day(new Date(Date.now() - i * 86400e3)));
  const res = await pipeline([
    ['HGETALL', 'stats:total'],
    ['HGETALL', 'stats:filled:type'], ['HGETALL', 'stats:downloads:type'],
    ['HGETALL', 'stats:filled:region'], ['HGETALL', 'stats:downloads:region'],
    ['HGETALL', 'stats:source'],
    ...days.map((d) => ['HGETALL', `stats:day:${d}`]),
    ...days.map((d) => ['HGETALL', `stats:source:${d}`]),
  ]);
  const [total, fType, dType, fRegion, dRegion, sources, ...rest] = res.map(toObj);
  const perDay = rest.slice(0, days.length);
  const perDaySource = rest.slice(days.length);

  const cards = FIELDS.map(([k, label]) => `<div class="card"><b>${n(total[k])}</b><span>${label}</span></div>`).join('');
  const table = (title, names, f, d) => `<h2>${title}</h2><table><tr><th></th><th>Заполнили</th><th>Скачали</th></tr>${
    Object.entries(names).map(([k, label]) => `<tr><td>${esc(label)}</td><td>${n(f[k])}</td><td>${n(d[k])}</td></tr>`).join('')}</table>`;
  const daily = `<h2>По дням (14 дней)</h2><table><tr><th></th>${FIELDS.map(([, l]) => `<th>${l}</th>`).join('')}<th>С ${PARTNER}</th></tr>${
    days.map((d, i) => `<tr><td>${d}</td>${FIELDS.map(([k]) => `<td>${n(perDay[i][k])}</td>`).join('')}<td>${n(perDaySource[i][PARTNER])}</td></tr>`).join('')}</table>`;
  const sourceRows = Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const from = `<h2>Откуда пришли (заходы)</h2><table><tr><th></th><th>Заходы</th></tr>${
    sourceRows.map(([k, v]) => `<tr><td>${k === 'direct' ? 'Напрямую' : esc(k)}</td><td>${n(v)}</td></tr>`).join('')
    || '<tr><td>Пока нет данных</td><td></td></tr>'}</table>`;

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Номерим — статистика</title>
<style>
  body { font: 15px/1.4 system-ui, sans-serif; margin: 0; padding: 24px 16px; background: #f6f7f9; color: #111; }
  main { max-width: 760px; margin: 0 auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card b { display: block; font-size: 28px; }
  .card span { color: #6b7280; }
  h2 { font-size: 17px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th, td { padding: 8px 12px; text-align: right; border-bottom: 1px solid #eef0f3; }
  th:first-child, td:first-child { text-align: left; }
  th { color: #6b7280; font-weight: 500; }
</style></head><body><main><h1>Статистика Номерим</h1>
<div class="cards">${cards}</div>
${from}
${table('По типу номера', TYPES, fType, dType)}
${table('По региону', REGIONS, fRegion, dRegion)}
${daily}
</main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
