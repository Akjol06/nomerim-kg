import { pipeline, day } from './_redis.mjs';

const EVENTS = { visit: 'visits', visitor: 'visitors', plate_filled: 'filled', plate_download: 'downloads' };
const TYPES = ['standard', 'named'];

export async function POST(request) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return new Response(null, { status: 400 }); }
  const field = EVENTS[body?.event];
  if (!field) return new Response(null, { status: 400 });

  const cmds = [
    ['HINCRBY', 'stats:total', field, 1],
    ['HINCRBY', `stats:day:${day()}`, field, 1],
  ];
  if (field === 'visits') {
    const source = String(body.source || '').toLowerCase().replace(/^www\./, '').slice(0, 60) || 'direct';
    if (/^[a-z0-9.-]+$/.test(source)) {
      cmds.push(['HINCRBY', 'stats:source', source, 1], ['HINCRBY', `stats:source:${day()}`, source, 1]);
    }
  }
  // Сам текст номера не сохраняется — только тип и регион.
  if (field === 'filled' || field === 'downloads') {
    const { type, region } = body;
    if (!TYPES.includes(type) || !/^0[1-9]$/.test(region)) return new Response(null, { status: 400 });
    cmds.push(['HINCRBY', `stats:${field}:type`, type, 1], ['HINCRBY', `stats:${field}:region`, region, 1]);
  }
  await pipeline(cmds);
  return new Response(null, { status: 204 });
}
