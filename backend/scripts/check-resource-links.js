import axios from 'axios';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';

const TIMEOUT_MS = 15000;
const CONCURRENCY = 5;

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function checkOne(resource) {
  const url = resource.url;
  const base = { skill: resource.skill_name, title: resource.title, url, flags: [] };
  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  };

  const attempt = async (method) =>
    axios.request({
      url,
      method,
      timeout: TIMEOUT_MS,
      maxRedirects: 10,
      headers,
      validateStatus: () => true,
    }).catch((err) => ({ error: err }));

  let res = await attempt('HEAD');
  let method = 'HEAD';

  // Some servers reject HEAD (403/405/415/501) or drop it — retry with GET.
  const status = res?.status;
  if (res?.error || [400, 403, 405, 415, 501].includes(status)) {
    res = await attempt('GET');
    method = 'GET';
  }

  if (res?.error) {
    const code = res.error.code ?? 'ERR';
    const timedOut = code === 'ECONNABORTED' || /timeout/i.test(res.error.message ?? '');
    base.flags.push(timedOut ? 'TIMEOUT' : `NETWORK_ERROR:${code}`);
    base.status = null;
    base.method = method;
    return base;
  }

  base.status = res.status;
  base.method = method;
  base.finalUrl = res.request?.res?.responseUrl ?? url;

  if (res.status >= 400) base.flags.push(res.status === 404 ? 'BROKEN_404' : `HTTP_${res.status}`);

  const from = hostOf(url);
  const to = hostOf(base.finalUrl);
  if (from && to && from !== to) {
    const expected = (from === 'youtu.be' && to === 'youtube.com') || (from === 'youtube.com' && to === 'www.youtube.com');
    if (!expected) base.flags.push(`REDIRECTED_HOST:${from}->${to}`);
  }
  if (base.finalUrl.replace(/\/$/, '') !== url.replace(/\/$/, '') && from === to) {
    base.flags.push('REDIRECTED_PATH');
  }

  return base;
}

async function main() {
  await connectDB({ retry: false });
  const resources = await ResourceCatalog.find({}).sort({ skill_name: 1, title: 1 }).lean();
  if (resources.length === 0) {
    console.log('No resources in the catalog — run `npm run seed` first.');
    await disconnectDB();
    return;
  }

  console.log(`Checking ${resources.length} resource URLs...\n`);

  const results = [];
  for (let i = 0; i < resources.length; i += CONCURRENCY) {
    const batch = resources.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(checkOne))));
  }

  const ok = [];
  const broken = [];
  const suspicious = [];

  for (const r of results) {
    const line = `${String(r.status ?? '---').padStart(3)} [${r.method}] ${r.skill} — ${r.title}\n      ${r.url}` +
      (r.finalUrl && r.finalUrl !== r.url ? `\n      -> ${r.finalUrl}` : '') +
      (r.flags.length ? `\n      FLAGS: ${r.flags.join(', ')}` : '');
    if (r.flags.some((f) => f.startsWith('BROKEN') || f.startsWith('TIMEOUT') || f.startsWith('NETWORK') || f.startsWith('HTTP_5'))) {
      broken.push(line);
    } else if (r.flags.length) {
      suspicious.push(line);
    } else {
      ok.push(line);
    }
  }

  console.log(`=== OK (${ok.length}) ===`);
  for (const line of ok) console.log(line);
  console.log(`\n=== SUSPICIOUS (${suspicious.length}) ===`);
  for (const line of suspicious) console.log(line);
  console.log(`\n=== BROKEN (${broken.length}) ===`);
  for (const line of broken) console.log(line);

  console.log(`\nSummary: ${ok.length} ok, ${suspicious.length} suspicious, ${broken.length} broken (${resources.length} total)`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Link check failed:', err.message);
  await disconnectDB();
  process.exit(1);
});