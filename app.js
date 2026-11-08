/* ReBeFit Napló — app.js
 * Vanilla JS PWA, minden adat a telefonon (localStorage), JSON mentéssel.
 */
'use strict';
(() => {

const APP_VERSION = '1.2.1';
const STORE_KEY = 'rbf-naplo-v1';
const PREV_KEY = 'rbf-naplo-v1-import-elotti';
const BACKUP_DAYS = 7;
const COLORS = ['#ff4d73', '#ff8a3d', '#f5c542', '#35d49a', '#2ec5d3', '#4d8dff', '#9b6bff', '#e05bd6', '#ff7aa8', '#8be36b', '#5ad1ff', '#ffa07a'];

const KINDS = {
  szemelyi: { label: 'Személyi', long: 'Személyi edzés', single: 'pt1' },
  vip:      { label: 'VIP',      long: 'VIP edzés',      single: 'vip' },
  pozo:     { label: 'Póz',      long: 'Pózoktatás',     single: 'pole1' },
};

// Árlista 2026.01.01-től (Beállítások → Árlista alatt módosítható)
const DEFAULT_SERVICES = [
  { id: 'pt1',    cat: 'szemelyi', name: 'Személyi edzés – 1 alkalom',        price: 6500,  sessions: 1,  days: 0,  single: true },
  { id: 'vip',    cat: 'vip',      name: 'VIP edzés – 1 alkalom',             price: 10000, sessions: 1,  days: 0,  single: true },
  { id: 'pole1',  cat: 'pozo',     name: 'Pózoktatás – 1 alkalom',            price: 7500,  sessions: 1,  days: 0,  single: true },
  { id: 'pt8',    cat: 'szemelyi', name: 'Személyi edzés – 8 alkalom / 30 nap',  price: 40000, sessions: 8,  days: 30 },
  { id: 'pt12',   cat: 'szemelyi', name: 'Személyi edzés – 12 alkalom / 30 nap', price: 50000, sessions: 12, days: 30 },
  { id: 'pkg8',   cat: 'szemelyi', name: '8 alkalom személyi + 4 hetes étrend',  price: 60000, sessions: 8,  days: 30 },
  { id: 'pkg12',  cat: 'szemelyi', name: '12 alkalom személyi + 4 hetes étrend', price: 70000, sessions: 12, days: 30 },
  { id: 'pole10', cat: 'pozo',     name: 'Pózoktatás – 10 alkalom / 90 nap',     price: 60000, sessions: 10, days: 90 },
];

/* ---------------- Utils ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const haptic = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const isTouch = matchMedia('(pointer: coarse)').matches;

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const mkey = s => s.slice(0, 7);
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const MONTHS_S = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const MONTHS_I = ['J', 'F', 'M', 'Á', 'M', 'J', 'J', 'A', 'Sz', 'O', 'N', 'D'];
const WD = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const WD_S = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const fmtDay = s => { const d = parse(s); return `${MONTHS_S[d.getMonth()]} ${d.getDate()}.`; };
const fmtDayLong = s => { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}., ${WD[d.getDay()]}`; };
const fmtMonth = k => { const [y, m] = k.split('-').map(Number); return `${y}. ${MONTHS[m - 1]}`; };
const shiftMonth = (k, n) => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const relDay = s => { const diff = daysBetween(today(), s); return diff === 0 ? 'ma' : diff === -1 ? 'tegnap' : diff === 1 ? 'holnap' : fmtDay(s); };
const nf = new Intl.NumberFormat('hu-HU');
const ft = n => nf.format(Math.round(n || 0)).replace(/\s/g, ' ') + ' Ft';
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const cmpSess = (a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || (a.createdAt || 0) - (b.createdAt || 0);
const huSort = (a, b) => a.localeCompare(b, 'hu');
const isPlanned = s => s.date > today();
const isoWd = date => (parse(date).getDay() + 6) % 7 + 1; // 1 = hétfő … 7 = vasárnap
const WD_LONG_MON = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];

/* ---------------- Icons ---------------- */
const I = (p, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ic = {
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>', 2.2),
  left: I('<path d="M15 18l-6-6 6-6"/>', 2.2),
  right: I('<path d="M9 18l6-6-6-6"/>', 2.2),
  plus: I('<path d="M12 5v14M5 12h14"/>', 2.2),
  close: I('<path d="M18 6 6 18M6 6l12 12"/>', 2.2),
  phone: I('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
  ticket: I('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/>'),
  receipt: I('<path d="M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  calCheck: I('<rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4"/>'),
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  upload: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  alert: I('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>', 2.4),
  copy: I('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  userPlus: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M19 8v6M16 11h6"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  tag: I('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>'),
  sparkle: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  shield: I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>'),
  grid: I('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
};

/* ---------------- Data ---------------- */
function emptyDb() {
  return {
    schema: 1,
    settings: { name: 'Rebeka', theme: 'auto', lastBackup: null, changes: 0 },
    services: clone(DEFAULT_SERVICES),
    clients: [], sessions: [], passes: [], billing: {},
  };
}
function migrate(d) {
  const base = emptyDb();
  const out = { ...base, ...d, settings: { ...base.settings, ...(d && d.settings || {}) } };
  if (!Array.isArray(out.services) || !out.services.length) out.services = clone(DEFAULT_SERVICES);
  for (const def of DEFAULT_SERVICES) if (!out.services.find(s => s.id === def.id)) out.services.push(clone(def));
  for (const k of ['clients', 'sessions', 'passes']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.billing || typeof out.billing !== 'object') out.billing = {};
  return out;
}
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? migrate(JSON.parse(raw)) : emptyDb(); }
  catch (e) { console.error(e); return emptyDb(); }
}
let db = load();
let cache = null;
let persistAsked = false;

function save(countChange = true) {
  if (countChange) db.settings.changes = (db.settings.changes || 0) + 1;
  cache = null;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('⚠️ Nem sikerült menteni: ' + e.message); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
}

/** Kiszámolja, melyik alkalom melyik bérletbe esik (dátum szerint, sorban). */
function derived() {
  if (cache) return cache;
  const t = today();
  const sessionPass = new Map(), passUsed = new Map(), passDone = new Map(), byClient = new Map(), passesBy = new Map();
  for (const s of db.sessions) { if (!byClient.has(s.clientId)) byClient.set(s.clientId, []); byClient.get(s.clientId).push(s); }
  for (const p of db.passes) { passUsed.set(p.id, 0); passDone.set(p.id, 0); if (!passesBy.has(p.clientId)) passesBy.set(p.clientId, []); passesBy.get(p.clientId).push(p); }
  for (const list of passesBy.values()) list.sort((a, b) => a.start.localeCompare(b.start) || (a.createdAt || 0) - (b.createdAt || 0));
  for (const [cid, list] of byClient) {
    list.sort(cmpSess);
    const ps = passesBy.get(cid) || [];
    for (const s of list) {
      let hit = null;
      for (const p of ps) {
        if (p.cat !== s.kind || s.date < p.start || s.date > p.end || passUsed.get(p.id) >= p.sessions) continue;
        hit = p; break;
      }
      if (hit) { passUsed.set(hit.id, passUsed.get(hit.id) + 1); if (s.date <= t) passDone.set(hit.id, passDone.get(hit.id) + 1); sessionPass.set(s.id, hit.id); }
      else sessionPass.set(s.id, null);
    }
  }
  const lastSeen = new Map(), planned = new Map();
  for (const [cid, list] of byClient) {
    const done = list.filter(s => s.date <= t), fut = list.filter(s => s.date > t);
    if (done.length) lastSeen.set(cid, done[done.length - 1].date);
    if (fut.length) planned.set(cid, fut);
  }
  cache = {
    sessionPass, passUsed, passDone, byClient, passesBy, lastSeen, planned,
    clientMap: new Map(db.clients.map(c => [c.id, c])),
    passMap: new Map(db.passes.map(p => [p.id, p])),
  };
  return cache;
}
const getClient = id => derived().clientMap.get(id);
const svc = id => db.services.find(s => s.id === id);
const singlePrice = kind => (svc(KINDS[kind].single) || {}).price || 0;
const sessionValue = s => (typeof s.unitPrice === 'number' ? s.unitPrice : singlePrice(s.kind));
const clientSessions = cid => derived().byClient.get(cid) || [];
const clientPasses = cid => derived().passesBy.get(cid) || [];

function passStatus(p) {
  const used = derived().passDone.get(p.id) || 0, t = today();
  if (used >= p.sessions) return 'used';
  if (t > p.end) return 'expired';
  if (t < p.start) return 'future';
  return 'active';
}
function currentPass(cid) {
  const ps = clientPasses(cid).filter(p => ['active', 'future'].includes(passStatus(p)));
  return ps.find(p => passStatus(p) === 'active') || ps[0] || null;
}
function passForNew(cid, kind, date) {
  const used = derived().passUsed;
  return clientPasses(cid).find(p => p.cat === kind && date >= p.start && date <= p.end && (used.get(p.id) || 0) < p.sessions) || null;
}
function needsBackup() {
  const s = db.settings;
  if (!s.changes) return false;
  if (!s.lastBackup) return db.sessions.length + db.clients.length > 0;
  const days = (Date.now() - new Date(s.lastBackup).getTime()) / 86400000;
  return days >= BACKUP_DAYS || s.changes >= 40;
}

function warnings() {
  const out = [], t = today(), used = derived().passDone;
  for (const p of db.passes) {
    const c = getClient(p.clientId); if (!c) continue;
    const u = used.get(p.id) || 0, left = p.sessions - u, st = passStatus(p);
    if (st === 'active') {
      const dl = daysBetween(t, p.end);
      const overflow = (derived().planned.get(c.id) || []).find(s => s.kind === p.cat && !derived().sessionPass.get(s.id));
      if (dl <= 5) out.push({ type: 'warn', cid: c.id, title: c.name, text: `Bérlet lejár ${dl === 0 ? 'ma' : dl + ' nap múlva'} · még ${left} alkalom` });
      else if (overflow && (derived().passUsed.get(p.id) || 0) >= p.sessions) out.push({ type: 'warn', cid: c.id, title: c.name, text: `A fix időpontokkal a bérlet elfogy, ${fmtDay(overflow.date)}-től alkalmi` });
      else if (left === 1) out.push({ type: 'warn', cid: c.id, title: c.name, text: `Utolsó alkalom van hátra a bérletből` });
    } else if (st === 'used') {
      const last = clientSessions(c.id).filter(s => derived().sessionPass.get(s.id) === p.id).pop();
      const hasNext = clientPasses(c.id).some(q => q.id !== p.id && q.cat === p.cat && ['active', 'future'].includes(passStatus(q)));
      if (last && daysBetween(last.date, t) <= 10 && !hasNext) out.push({ type: 'danger', cid: c.id, title: c.name, text: `Elfogyott a bérlet (${p.sessions}/${p.sessions}) – jöhet az új?` });
    } else if (st === 'expired' && left > 0 && daysBetween(p.end, t) <= 10) {
      out.push({ type: 'danger', cid: c.id, title: c.name, text: `Lejárt a bérlet, ${left} alkalom kihasználatlan maradt` });
    }
  }
  return out;
}

function monthStats(mk) {
  const d = derived();
  const all = db.sessions.filter(s => mkey(s.date) === mk);
  const sess = all.filter(s => !isPlanned(s));
  const singles = sess.filter(s => !d.sessionPass.get(s.id)).reduce((a, s) => a + sessionValue(s), 0);
  const sold = db.passes.filter(p => mkey(p.start) === mk).reduce((a, p) => a + (p.price || 0), 0);
  return { count: sess.length, planned: all.length - sess.length, clients: new Set(sess.map(s => s.clientId)).size, revenue: singles + sold, singles, sold };
}

function billingFor(cid, mk) {
  const d = derived();
  const allM = clientSessions(cid).filter(s => mkey(s.date) === mk);
  const sess = allM.filter(s => !isPlanned(s)), plannedM = allM.filter(isPlanned);
  const singles = { szemelyi: [], vip: [], pozo: [] }, passGroups = new Map();
  for (const s of sess) {
    const pid = d.sessionPass.get(s.id);
    if (pid) { if (!passGroups.has(pid)) passGroups.set(pid, []); passGroups.get(pid).push(s); }
    else singles[s.kind].push(s);
  }
  const singleLines = Object.entries(singles).filter(([, l]) => l.length).map(([kind, l]) => {
    const total = l.reduce((a, s) => a + sessionValue(s), 0);
    const units = [...new Set(l.map(sessionValue))];
    return { kind, count: l.length, total, unit: units.length === 1 ? units[0] : null, dates: l.map(s => s.date) };
  });
  const passLines = [...passGroups].map(([pid, l]) => ({ pass: d.passMap.get(pid), count: l.length, used: d.passDone.get(pid) || 0, dates: l.map(s => s.date) }));
  const sold = clientPasses(cid).filter(p => mkey(p.start) === mk);
  const singlesTotal = singleLines.reduce((a, l) => a + l.total, 0);
  const soldDue = sold.filter(p => !p.paid).reduce((a, p) => a + (p.price || 0), 0);
  let tip = null;
  const sz = singleLines.find(l => l.kind === 'szemelyi');
  if (sz && sz.count >= 8) {
    const pkg = sz.count >= 12 ? svc('pt12') : svc('pt8');
    if (pkg && pkg.price < sz.total) tip = `Tipp: ${sz.count} alkalom alkalmi áron ${ft(sz.total)} – a „${pkg.name}” bérlettel ${ft(pkg.price)} lenne.`;
  }
  const pz = singleLines.find(l => l.kind === 'pozo');
  if (!tip && pz && pz.count >= 10) { const pkg = svc('pole10'); if (pkg && pkg.price < pz.total) tip = `Tipp: a 10 alkalmas pózbérlettel ${ft(pkg.price)} lenne ${ft(pz.total)} helyett.`; }
  return { sess, planned: plannedM, singleLines, passLines, sold, singlesTotal, soldDue, due: singlesTotal + soldDue, tip, billed: !!db.billing[cid + '|' + mk] };
}

/* ---------------- UI state ---------------- */
const state = { tab: 'home', calMonth: mkey(today()), selDate: today(), billMonth: mkey(today()), q: '' };
const pages = []; // {el, render}
let sentinel = false; // egyetlen history-bejegyzés az Android vissza-gombhoz
const ensureSentinel = () => { if (!sentinel) { try { history.pushState({ rbf: 1 }, ''); sentinel = true; } catch (e) {} } };

/* ---------------- Render: Home ---------------- */
function viewHome() {
  const t = today(), mk = mkey(t), st = monthStats(mk);
  const name = db.settings.name || 'Rebeka';
  const hour = new Date().getHours();
  const greet = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Szia' : 'Szép estét';
  const head = `<header class="vhead"><div><p class="eyebrow">${fmtDayLong(t)}</p><h1 class="title">${greet}, <em>${esc(name)}</em></h1></div>
    <button class="icon-btn" data-action="settings" aria-label="Beállítások">${ic.gear}${needsBackup() ? '<span class="badge-dot"></span>' : ''}</button></header>`;

  if (!db.clients.length) {
    return head + `<div class="enter"><section class="card welcome">
      <img class="logo" src="icons/icon-192.png" alt="">
      <h2>Üdv a ReBeFit Naplóban</h2>
      <p>Edzések, bérletek és havi elszámolás – egy helyen, a telefonodon.</p>
      <div class="steps">
        <div><i>1</i>Vedd fel a klienseidet</div>
        <div><i>2</i>Rögzítsd, ki mikor volt nálad – utólag is</div>
        <div><i>3</i>Hó végén az Elszámolás fül mindent összead</div>
      </div>
      <button class="btn primary block" data-action="new-client">${ic.userPlus} Első kliens felvétele</button>
      <button class="btn block" style="margin-top:10px" data-action="import">${ic.upload} Mentés visszatöltése</button>
      <button class="btn block" style="margin-top:10px;background:none;border:0;color:var(--muted)" data-action="demo">${ic.sparkle} Kipróbálom bemutató adatokkal</button>
    </section></div>`;
  }

  const bars = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(mk, -i);
    bars.push({ k, n: db.sessions.filter(s => mkey(s.date) === k && !isPlanned(s)).length, m: Number(k.slice(5)) - 1 });
  }
  const max = Math.max(1, ...bars.map(b => b.n));
  const todays = db.sessions.filter(s => s.date === t).sort(cmpSess);
  const warns = warnings();

  return head + `<div class="enter">
    ${needsBackup() ? `<button class="backup-banner" data-action="backup"><span class="a-ic">${ic.shield}</span>
      <span class="row-main"><b>Ideje menteni</b><small>${db.settings.lastBackup ? 'Utolsó mentés: ' + relDay(iso(new Date(db.settings.lastBackup))) : 'Még nem volt mentés'} · ${db.settings.changes} változás</small></span><span class="go">Mentés</span></button>` : ''}
    <section class="hero">
      <div class="hero-top"><span class="eyebrow">${fmtMonth(mk)}</span><span class="chip-s accent">${st.clients} kliens</span></div>
      <div class="hero-num"><span class="big" data-count="${st.count}">${st.count}</span><span class="unit">alkalom<br>ebben a hónapban${st.planned ? `<br><span style="color:var(--faint)">+${st.planned} tervezett</span>` : ''}</span></div>
      <div class="hero-foot">
        <div><span class="lbl">Várható bevétel</span><span class="val" data-count="${st.revenue}" data-ft="1">${ft(st.revenue)}</span></div>
        <div class="bars">${bars.map((b, i) => `<div class="bar ${i === 5 ? 'cur' : ''}"><i style="height:${Math.max(6, b.n / max * 100)}%;animation-delay:${i * 60}ms"></i><b>${MONTHS_I[b.m]}</b></div>`).join('')}</div>
      </div>
    </section>

    <div class="section-h"><h2>Mai edzések</h2><button class="link" data-action="quick-add" data-date="${t}">+ Hozzáadás</button></div>
    ${todays.length ? `<div class="list">${todays.map(s => sessionRow(s)).join('')}</div>`
      : `<div class="empty"><div class="em-ic">${ic.calCheck}</div><b>Ma még nincs rögzítve edzés</b>Bökj a + gombra, ha valaki volt nálad.</div>`}

    ${warns.length ? `<div class="section-h"><h2>Figyelj rá</h2></div><div class="list">${warns.map(w => `
      <button class="alert ${w.type}" data-action="open-client" data-id="${w.cid}"><span class="a-ic">${w.type === 'danger' ? ic.ticket : ic.clock}</span>
      <span class="row-main"><b>${esc(w.title)}</b><small>${esc(w.text)}</small></span><span class="chev">${ic.right}</span></button>`).join('')}</div>` : ''}

    <div class="section-h"><h2>Legutóbbi</h2><button class="link" data-tab-go="calendar">Naptár</button></div>
    <div class="list">${db.sessions.filter(s => s.date < t).sort(cmpSess).reverse().slice(0, 4).map(s => sessionRow(s, true)).join('') || '<div class="empty">Még nincs korábbi alkalom.</div>'}</div>
  </div>`;
}

function sessionRow(s, showDate = false) {
  const c = getClient(s.clientId) || { name: 'Törölt kliens', color: '#888' };
  const pid = derived().sessionPass.get(s.id);
  const p = pid && derived().passMap.get(pid);
  let n = 0;
  if (p) n = clientSessions(s.clientId).filter(x => derived().sessionPass.get(x.id) === pid && cmpSess(x, s) <= 0).length;
  let sub = p ? `<span class="tag-pass">Bérlet ${n}/${p.sessions}</span>` : `<span class="tag-single">Alkalmi · ${ft(sessionValue(s))}</span>`;
  if (isPlanned(s)) sub = `<span class="tag-plan">Tervezett</span> · ${sub}`;
  return `<button class="row" data-action="open-session" data-id="${s.id}">
    ${showDate ? `<span class="time">${relDay(s.date)}</span>` : `<span class="time ${s.time ? '' : 'none'}">${s.time || '–'}</span>`}
    <span class="avatar" style="--c:${c.color}">${esc(initials(c.name))}</span>
    <span class="row-main"><b>${esc(c.name)}</b><small>${sub}${s.note ? ' · ' + esc(s.note) : ''}</small></span>
    <span class="pill k-${s.kind}">${KINDS[s.kind].label}</span></button>`;
}

/* ---------------- Render: Calendar ---------------- */
function calGrid(mk, cellFn) {
  const [y, m] = mk.split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = lead; i > 0; i--) cells.push(cellFn(addDays(iso(first), -i), true));
  for (let d = 1; d <= dim; d++) cells.push(cellFn(`${mk}-${pad(d)}`, false));
  while (cells.length % 7) cells.push(cellFn(addDays(`${mk}-${pad(dim)}`, cells.length - lead - dim + 1), true));
  return `<div class="cal-wd">${WD_S.map(w => `<span>${w}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div>`;
}

function viewCalendar(dir) {
  const mk = state.calMonth, t = today();
  const byDate = new Map();
  for (const s of db.sessions) { if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(s); }
  const monthAll = db.sessions.filter(s => mkey(s.date) === mk);
  const monthCount = monthAll.filter(s => !isPlanned(s)).length, monthPlan = monthAll.length - monthCount;
  const grid = calGrid(mk, (date, out) => {
    const list = byDate.get(date) || [];
    const colors = [...new Set(list.map(s => (getClient(s.clientId) || {}).color || '#888'))].slice(0, 4);
    const pl = date > t;
    const cls = ['day', out && 'out', list.length && 'has', date === t && 'today', date === state.selDate && 'sel', date > t && 'future'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-action="pick-day" data-date="${date}"><span>${Number(date.slice(8))}</span>
      ${list.length > 1 ? `<span class="cnt">${list.length}</span>` : ''}<span class="dots">${colors.map(c => `<i class="${pl ? 'pl' : ''}" style="--c:${c}"></i>`).join('')}</span></button>`;
  });
  const sel = (byDate.get(state.selDate) || []).sort(cmpSess);
  const [, mm] = mk.split('-').map(Number);
  return `<header class="vhead"><div><p class="eyebrow">Naptár</p><h1 class="title">Ki volt <em>itt?</em></h1></div>
    <button class="icon-btn" data-action="cal-today" aria-label="Ugrás a mai napra">${ic.calCheck}</button></header>
    <div class="${dir ? '' : 'enter'}">
    <section class="card cal-card" id="cal-card">
      <div class="cal-head">
        <div class="m">${MONTHS[mm - 1]} <span style="color:var(--muted);font-weight:600">${mk.slice(0, 4)}</span><small>${monthCount} alkalom${monthPlan ? ` · ${monthPlan} tervezett` : ''}</small></div>
        <div class="cal-nav"><button class="icon-btn" data-action="cal-prev" aria-label="Előző hónap">${ic.left}</button><button class="icon-btn" data-action="cal-next" aria-label="Következő hónap">${ic.right}</button></div>
      </div>
      <div id="cal-grid-wrap">${grid.replace('class="cal-grid"', `class="cal-grid ${dir === 1 ? 'slide-l' : dir === -1 ? 'slide-r' : ''}"`)}</div>
    </section>
    <div class="section-h"><h2>${fmtDayLong(state.selDate)}</h2><button class="link" data-action="quick-add" data-date="${state.selDate}">+ Alkalom</button></div>
    ${sel.length ? `<div class="list">${sel.map(s => sessionRow(s)).join('')}</div>`
      : `<div class="empty"><div class="em-ic">${ic.calCheck}</div><b>Nincs rögzítve alkalom</b>${state.selDate < t ? 'Utólag is felviheted, ha valaki itt volt.' : state.selDate === t ? 'Ha valaki ma volt nálad, rögzítsd.' : 'Előre is beírhatod, ha már tudod.'}
        <br><button class="btn primary sm" data-action="quick-add" data-date="${state.selDate}">${ic.plus} Alkalom erre a napra</button></div>`}
    </div>`;
}

/* ---------------- Render: Clients ---------------- */
function viewClients() {
  return `<header class="vhead"><div><p class="eyebrow">${db.clients.length} kliens</p><h1 class="title">Kliensek</h1></div>
    <button class="icon-btn" data-action="new-client" aria-label="Új kliens">${ic.userPlus}</button></header>
    <div class="enter">
    <div class="search">${ic.search}<input type="search" id="client-q" placeholder="Keresés név alapján…" value="${esc(state.q)}" autocomplete="off"></div>
    <div class="list" id="client-list">${clientListHtml()}</div></div>`;
}
function clientListHtml() {
  const q = state.q.trim().toLowerCase();
  const mk = mkey(today());
  const list = db.clients.filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => (derived().lastSeen.get(b.id) || '').localeCompare(derived().lastSeen.get(a.id) || '') || huSort(a.name, b.name));
  if (!db.clients.length) return `<div class="empty"><div class="em-ic">${ic.users}</div><b>Még nincs kliens</b>Vedd fel az elsőt, és már rögzítheted is az alkalmait.<br><button class="btn primary sm" data-action="new-client">${ic.userPlus} Új kliens</button></div>`;
  if (!list.length) return `<div class="empty">Nincs találat erre: „${esc(state.q)}”<br><button class="btn primary sm" data-action="new-client" data-name="${esc(state.q)}">${ic.userPlus} Felveszem</button></div>`;
  return list.map(c => {
    const p = currentPass(c.id);
    const n = clientSessions(c.id).filter(s => mkey(s.date) === mk && !isPlanned(s)).length;
    let sub;
    if (p) { const u = derived().passDone.get(p.id) || 0; sub = `<span class="tag-pass">Bérlet ${u}/${p.sessions}</span> · lejár ${fmtDay(p.end)}`; }
    else {
      const ls = derived().lastSeen.get(c.id), lp = clientPasses(c.id).slice(-1)[0];
      const lpRecent = lp && daysBetween(lp.end, today()) <= 14;
      if (lp && lpRecent && passStatus(lp) === 'used') sub = `<span style="color:var(--warn)">Bérlet elfogyott</span>${ls ? ' · utoljára ' + relDay(ls) : ''}`;
      else if (lp && lpRecent && passStatus(lp) === 'expired') sub = `<span style="color:var(--warn)">Bérlet lejárt</span>${ls ? ' · utoljára ' + relDay(ls) : ''}`;
      else sub = ls ? `Alkalmi · utoljára ${relDay(ls)}` : 'Még nem volt alkalom';
    }
    return `<button class="row" data-action="open-client" data-id="${c.id}">
      <span class="avatar" style="--c:${c.color}">${esc(initials(c.name))}</span>
      <span class="row-main"><b>${esc(c.name)}</b><small>${sub}${getSched(c) ? ` · <span class="tag-fix">Fix: ${esc(schedLabel(getSched(c), true))}</span>` : ''}</small></span>
      <span class="end"><b>${n}</b><small>e hónapban</small></span></button>`;
  }).join('');
}

/* ---------------- Render: Billing ---------------- */
function viewBilling() {
  const mk = state.billMonth;
  const ids = new Set([...db.sessions.filter(s => mkey(s.date) === mk).map(s => s.clientId), ...db.passes.filter(p => mkey(p.start) === mk).map(p => p.clientId)]);
  const rows = [...ids].map(id => ({ c: getClient(id), b: billingFor(id, mk) })).filter(r => r.c).sort((a, b) => huSort(a.c.name, b.c.name));
  const total = rows.reduce((a, r) => a + r.b.due, 0);
  const done = rows.filter(r => r.b.billed).length;
  const count = rows.reduce((a, r) => a + r.b.sess.length, 0), planCount = rows.reduce((a, r) => a + r.b.planned.length, 0);
  return `<header class="vhead"><div><p class="eyebrow">Havi összesítő</p><h1 class="title">Elszámolás</h1></div></header>
    <div class="enter">
    <div class="cal-head card" style="padding:12px 12px 12px 18px;border-radius:20px">
      <div class="m" style="font-size:24px">${fmtMonth(mk)}</div>
      <div class="cal-nav"><button class="icon-btn" data-action="bill-prev">${ic.left}</button><button class="icon-btn" data-action="bill-next">${ic.right}</button></div>
    </div>
    <section class="hero" style="margin-top:12px">
      <div class="hero-top"><span class="eyebrow">Számlázandó</span><span class="chip-s ${done === rows.length && rows.length ? 'accent' : ''}">${done}/${rows.length} kész</span></div>
      <div class="hero-num" style="margin-bottom:6px"><span class="big" style="font-size:58px" data-count="${total}" data-ft="1">${ft(total)}</span></div>
      <p style="color:var(--muted);font-size:13px;position:relative">${count} alkalom${planCount ? ` · ${planCount} tervezett még hátra` : ''} · ${rows.length} kliens</p>
    </section>
    <div class="section-h"><h2>Kliensenként</h2></div>
    ${rows.length ? `<div class="list">${rows.map(({ c, b }) => {
      const parts = [];
      const pc = b.passLines.reduce((a, l) => a + l.count, 0), sc = b.singleLines.reduce((a, l) => a + l.count, 0);
      if (pc) parts.push(`${pc} bérletből`);
      if (sc) parts.push(`${sc} alkalmi`);
      if (b.sold.length) parts.push(`${b.sold.length} új bérlet`);
      return `<button class="row bill-row" data-action="open-bill" data-id="${c.id}">
        <span class="status-dot ${b.billed ? 'ok' : ''}"></span>
        <span class="avatar" style="--c:${c.color}">${esc(initials(c.name))}</span>
        <span class="row-main"><b>${esc(c.name)}</b><small>${b.sess.length} alkalom${b.planned.length ? ` (+${b.planned.length} tervezett)` : ''} · ${parts.join(' · ') || '—'}</small></span>
        <span class="end"><b>${b.due ? ft(b.due) : '—'}</b><small>${b.billed ? 'számlázva' : 'nyitott'}</small></span></button>`;
    }).join('')}</div>` : `<div class="empty"><div class="em-ic">${ic.receipt}</div><b>Ebben a hónapban nincs elszámolnivaló</b>Lapozz a nyilakkal egy másik hónapra.</div>`}
    </div>`;
}

/* ---------------- Client page ---------------- */
function ringSvg(used, total) {
  const r = 30, C = 2 * Math.PI * r, pct = Math.min(1, used / Math.max(1, total));
  return `<div class="ring"><svg viewBox="0 0 74 74"><circle class="track" cx="37" cy="37" r="${r}" fill="none" stroke-width="7"/>
    <circle class="prog" cx="37" cy="37" r="${r}" fill="none" stroke-width="7" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-offset="${C * (1 - pct)}"/></svg>
    <div class="rt"><div><b>${used}</b><small>/ ${total}</small></div></div></div>`;
}
function passCard(p) {
  const used = derived().passDone.get(p.id) || 0, st = passStatus(p), plan = (derived().passUsed.get(p.id) || 0) - used;
  const label = { active: 'Aktív', future: 'Később indul', used: 'Elfogyott', expired: 'Lejárt' }[st];
  const dl = daysBetween(today(), p.end);
  const sub = st === 'active' ? `${p.sessions - used} alkalom maradt${plan ? ` (${plan} már betervezve)` : ''} · még ${dl} nap` : st === 'future' ? `Indul: ${fmtDay(p.start)}` : `${fmtDay(p.start)} – ${fmtDay(p.end)}`;
  return `<button class="card pass-card" style="width:100%;text-align:left" data-action="edit-pass" data-id="${p.id}">
    ${ringSvg(used, p.sessions)}
    <div class="pass-info"><span class="chip-s ${st === 'active' ? 'accent' : ''}" style="margin-bottom:6px">${label}${p.paid ? ' · fizetve' : ''}</span>
      <b>${esc(p.name)}</b><small>${sub}</small><small>${fmtDay(p.start)} – ${fmtDay(p.end)} · ${ft(p.price)}</small></div></button>`;
}
function pageClient(id) {
  const c = getClient(id);
  if (!c) return `<div class="page-inner"><div class="page-top"><button class="icon-btn" data-action="close-page">${ic.back}</button></div><div class="empty">A kliens törölve lett.</div></div>`;
  const sess = clientSessions(id).slice().sort(cmpSess).reverse();
  const mk = mkey(today());
  const thisMonth = sess.filter(s => mkey(s.date) === mk && !isPlanned(s)).length;
  const doneSess = sess.filter(s => !isPlanned(s));
  const fut = derived().planned.get(id) || [];
  const sch = getSched(c);
  const passes = clientPasses(id).slice().reverse();
  const cur = passes.filter(p => ['active', 'future'].includes(passStatus(p)));
  const old = passes.filter(p => !cur.includes(p));
  const groups = new Map();
  for (const s of sess) { const k = mkey(s.date); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const sp = derived().sessionPass;
  return `<div class="page-inner" style="--pc:${c.color}">
    <div class="page-top"><button class="icon-btn" data-action="close-page" aria-label="Vissza">${ic.back}</button>
      <button class="icon-btn" data-action="edit-client" data-id="${id}" aria-label="Szerkesztés">${ic.edit}</button></div>
    <div class="profile"><span class="avatar xl" style="--c:${c.color}">${esc(initials(c.name))}</span>
      <h1>${esc(c.name)}</h1>
      <p>${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a>` : 'Nincs telefonszám'}${c.note ? ' · ' + esc(c.note) : ''}</p></div>
    <div class="stats">
      <div class="stat"><div class="n">${thisMonth}</div><div class="t">E HÓNAPBAN</div></div>
      <div class="stat"><div class="n">${doneSess.length}</div><div class="t">ÖSSZESEN</div></div>
      <div class="stat"><div class="n" style="font-size:22px;line-height:32px">${doneSess.length ? relDay(doneSess[0].date) : '–'}</div><div class="t">UTOLJÁRA</div></div>
    </div>
    <div class="actions">
      <button class="action primary" data-action="quick-add" data-client="${id}"><span class="ai">${ic.plus}</span>Alkalom</button>
      <button class="action" data-action="mark-days" data-id="${id}"><span class="ai">${ic.grid}</span>Napok jelölése</button>
      <button class="action" data-action="new-pass" data-id="${id}"><span class="ai">${ic.ticket}</span>Új bérlet</button>
    </div>
    <div class="section-h"><h2>Fix időpont</h2>${sch ? `<button class="link" data-action="schedule" data-id="${id}">Módosítás</button>` : ''}</div>
    ${sch ? `<button class="card sched-card" data-action="schedule" data-id="${id}">
        <span class="sched-days">${[1, 2, 3, 4, 5, 6, 7].map(d => sch.slots[d] !== undefined ? `<i class="on">${WD_S[d - 1]}<small>${esc(sch.slots[d] || '–')}</small></i>` : `<i>${WD_S[d - 1]}</i>`).join('')}</span>
        <span class="sched-info"><b>${esc(schedLabel(sch))} · ${KINDS[sch.kind].label}</b><small>${fut.length ? `${fut.length} tervezett alkalom a naptárban · utolsó: ${fmtDay(fut[fut.length - 1].date)}` : 'Nincs előre beírt alkalom – bökj ide a beíráshoz'}</small></span>
      </button>`
      : `<button class="card sched-card empty-sched" data-action="schedule" data-id="${id}"><span class="ai">${ic.clock}</span><span class="sched-info"><b>Fix időpont beállítása</b><small>pl. hétfő 16:00, szerda–csütörtök 15:00 – és előre beírja a naptárba</small></span></button>`}
    ${cur.length ? `<div class="section-h"><h2>Bérlet</h2></div><div class="list">${cur.map(passCard).join('')}</div>` : ''}
    <div class="section-h"><h2>Alkalmak havonta</h2>${sess.length ? `<button class="link" data-action="open-bill" data-id="${id}" data-month="${mk}">Elszámolás</button>` : ''}</div>
    ${groups.size ? [...groups].map(([k, l]) => { const dn = l.filter(s => !isPlanned(s)).length, pn = l.length - dn; return `<div class="month-group"><div class="mg-h"><b>${fmtMonth(k)}</b><span>${dn} alkalom${pn ? ` · ${pn} tervezett` : ''}</span></div>
      <div class="grouped">${l.map(s => {
        const pid = sp.get(s.id);
        return `<button class="mini-row" data-action="open-session" data-id="${s.id}"><span class="d">${fmtDay(s.date)}<small>${WD[parse(s.date).getDay()]}${s.time ? ' · ' + s.time : ''}</small></span>
          <span class="${isPlanned(s) ? 'tag-plan' : pid ? 'tag-pass' : 'tag-single'}" style="font-size:12px;font-weight:600">${isPlanned(s) ? 'tervezett' : pid ? 'bérlet' : 'alkalmi'}</span><span class="pill k-${s.kind}">${KINDS[s.kind].label}</span></button>`;
      }).join('')}</div></div>`; }).join('')
      : `<div class="empty"><div class="em-ic">${ic.calCheck}</div><b>Még nincs alkalom</b>Rögzítsd a mait, vagy jelöld be a korábbi napokat.<br><button class="btn primary sm" data-action="mark-days" data-id="${id}">${ic.grid} Napok jelölése</button></div>`}
    ${old.length ? `<div class="section-h"><h2>Korábbi bérletek</h2></div><div class="list">${old.map(passCard).join('')}</div>` : ''}
    <div style="height:20px"></div>
  </div>`;
}

/* ---------------- Main render ---------------- */
function render(animate = false, dir = 0) {
  const views = { home: viewHome, calendar: () => viewCalendar(dir), clients: viewClients, billing: viewBilling };
  const v = $('#view');
  v.innerHTML = views[state.tab]();
  if (!animate) $$('.enter', v).forEach(e => e.classList.remove('enter'));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  afterRender(v, animate);
  if (state.tab === 'calendar') bindCalSwipe();
}
function refresh() {
  const y = window.scrollY;
  render(false);
  window.scrollTo(0, y);
  for (const p of pages) {
    const sc = $('.page-scroll', p.el), top = sc.scrollTop;
    sc.innerHTML = p.render();
    sc.scrollTop = top;
    afterRender(sc, false);
  }
}
function afterRender(root, animate) {
  if (animate) {
    $$('[data-count]', root).forEach(el => {
      const target = Number(el.dataset.count), isFt = el.dataset.ft;
      if (!target) return;
      const t0 = performance.now(), dur = 900;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = Math.round(target * e);
        el.textContent = isFt ? ft(v) : v;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.ring .prog', root).forEach(c => { c.style.strokeDashoffset = c.dataset.offset; });
  }));
}
function setTab(tab) {
  if (state.tab === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  state.tab = tab;
  haptic();
  render(true);
  window.scrollTo(0, 0);
}

function bindCalSwipe() {
  const el = $('#cal-card'); if (!el) return;
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) calShift(dx < 0 ? 1 : -1);
  }, { passive: true });
}
function calShift(n) {
  state.calMonth = shiftMonth(state.calMonth, n);
  const t = today();
  state.selDate = mkey(t) === state.calMonth ? t : `${state.calMonth}-01`;
  haptic();
  render(false, n);
}

/* ---------------- Layers: pages, sheets, toasts ---------------- */
function openPage(renderFn) {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = `<div class="page-scroll">${renderFn()}</div>`;
  $('#page-layer').appendChild(el);
  pages.push({ el, render: renderFn });
  document.body.classList.add('has-page');
  ensureSentinel();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  afterRender(el, true);
  bindEdgeSwipe(el);
}
function closePage() {
  const p = pages.pop(); if (!p) return false;
  p.el.classList.remove('open');
  setTimeout(() => p.el.remove(), 450);
  if (!pages.length) document.body.classList.remove('has-page');
  return true;
}
function bindEdgeSwipe(el) { // iOS-szerű visszahúzás a bal szélről
  let x0 = null, y0 = 0, dx = 0;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; if (t.clientX < 28) { x0 = t.clientX; y0 = t.clientY; dx = 0; el.style.transition = 'none'; } }, { passive: true });
  el.addEventListener('touchmove', e => { if (x0 === null) return; const t = e.touches[0]; dx = Math.max(0, t.clientX - x0); if (Math.abs(t.clientY - y0) > 40 && dx < 30) { x0 = null; el.style.transform = ''; el.style.transition = ''; return; } el.style.transform = `translateX(${dx}px)`; }, { passive: true });
  el.addEventListener('touchend', () => { if (x0 === null) return; x0 = null; el.style.transition = ''; el.style.transform = ''; if (dx > 90) closePage(); }, { passive: true });
}

function openSheet(html, { onMount } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  $('#sheet-layer').appendChild(wrap);
  ensureSentinel();
  const sheet = $('.sheet', wrap);
  onMount && onMount(sheet, wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  bindSheetDrag(wrap, sheet);
  return sheet;
}
function closeSheet() {
  const w = $$('.sheet-wrap:not(.closing)').pop(); if (!w) return false;
  w.classList.remove('open'); w.classList.add('closing');
  setTimeout(() => w.remove(), 320);
  return true;
}
function bindSheetDrag(wrap, sheet) {
  let y0 = null, dy = 0;
  const start = e => { if (sheet.scrollTop > 0) return; const tgt = e.target; if (!tgt.closest('.grabber, .sheet-head')) return; y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; };
  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sheet.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 110) closeSheet(); }, { passive: true });
}
window.addEventListener('popstate', () => {
  sentinel = false;
  if ($$('.sheet-wrap:not(.closing)').length) closeSheet();
  else if (pages.length) closePage();
  if ($$('.sheet-wrap:not(.closing)').length || pages.length) ensureSentinel();
});

function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ''}`;
  $('#toast-layer').appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  const tm = setTimeout(kill, opts.duration || (opts.action ? 5000 : 2600));
  if (opts.action) $('button', el).onclick = () => { clearTimeout(tm); kill(); opts.onAction && opts.onAction(); };
}

function confirmDialog({ title, text, ok = 'Igen', danger = false }) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (done) return; done = true; res(v); };
    openSheet(`<div class="sheet-head"><div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div></div>
      <div class="btn-row"><button class="btn" data-x="no">Mégse</button><button class="btn ${danger ? 'primary' : 'primary'}" data-x="yes" ${danger ? 'style="background:linear-gradient(135deg,#ff6b6b,#e0243c)"' : ''}>${esc(ok)}</button></div>`, {
      onMount: (s, wrap) => {
        $('[data-x="no"]', s).onclick = () => { finish(false); closeSheet(); };
        $('[data-x="yes"]', s).onclick = () => { finish(true); closeSheet(); };
        new MutationObserver((_, obs) => { if (!wrap.isConnected) { finish(false); obs.disconnect(); } }).observe($('#sheet-layer'), { childList: true });
      }
    });
  });
}

/* ---------------- Sheets: quick add ---------------- */
function quickAdd({ date = today(), clientIds = [] } = {}) {
  if (!db.clients.length) { clientForm(null, { thenAdd: true }); return; }
  const st = { date, time: '', sel: new Set(clientIds), q: '', kind: null, kindTouched: false };
  const one = clientIds.length === 1 ? getClient(clientIds[0]) : null;
  st.kind = (one && one.lastKind) || 'szemelyi';
  openSheet(`<div class="sheet-head"><div><h2>Új alkalom</h2><p id="qa-sub"></p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <div class="field-row">
        <label class="field"><span>Dátum</span><input type="date" id="qa-date" value="${date}"></label>
        <label class="field"><span>Időpont <em>(nem kötelező)</em></span><input type="time" id="qa-time" step="300"></label>
      </div>
      <div class="seg k" id="qa-kind">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}">${v.label}</button>`).join('')}</div>
      <div class="field"><span>Ki volt ott? <em>– többet is kijelölhetsz</em></span><input type="search" id="qa-q" placeholder="Keresés vagy új név…" autocomplete="off"></div>
      <div class="chips" id="qa-chips"></div>
      <div class="qa-summary" id="qa-sum"></div>
      <button class="btn primary block" id="qa-save">${ic.check} Mentés</button>
    </div>`, {
    onMount: s => {
      const draw = () => {
        $('#qa-sub', s).textContent = fmtDayLong(st.date) + (st.date < today() ? ' · utólagos' : '');
        $$('#qa-kind button', s).forEach(b => b.classList.toggle('on', b.dataset.kind === st.kind));
        const q = st.q.trim().toLowerCase();
        const ls = derived().lastSeen;
        const list = db.clients.filter(c => !q || c.name.toLowerCase().includes(q) || st.sel.has(c.id))
          .sort((a, b) => (st.sel.has(b.id) - st.sel.has(a.id)) || (ls.get(b.id) || '').localeCompare(ls.get(a.id) || '') || huSort(a.name, b.name));
        const exact = db.clients.some(c => c.name.toLowerCase() === q);
        $('#qa-chips', s).innerHTML = list.map(c => `<button class="chip ${st.sel.has(c.id) ? 'on' : ''}" data-cid="${c.id}"><span class="avatar sm" style="--c:${c.color}">${st.sel.has(c.id) ? '✓' : esc(initials(c.name))}</span>${esc(c.name)}</button>`).join('')
          + (q && !exact ? `<button class="chip new" data-new="1">+ Új kliens: „${esc(st.q.trim())}”</button>` : '');
        const sum = [...st.sel].map(id => {
          const c = getClient(id); if (!c) return '';
          const p = passForNew(id, st.kind, st.date);
          const dup = clientSessions(id).some(x => x.date === st.date && x.kind === st.kind);
          const right = p ? `<b class="tag-pass">bérletből ${(derived().passUsed.get(p.id) || 0) + 1}/${p.sessions}</b>` : `<b>alkalmi · ${ft(singlePrice(st.kind))}</b>`;
          return `<div><span>${esc(c.name)}${dup ? ' <span class="w">· már van ezen a napon</span>' : ''}</span>${right}</div>`;
        }).join('');
        $('#qa-sum', s).innerHTML = sum;
        const btn = $('#qa-save', s);
        btn.disabled = !st.sel.size;
        btn.innerHTML = `${ic.check} ${st.sel.size > 1 ? st.sel.size + ' alkalom mentése' : 'Mentés'}`;
      };
      $('#qa-date', s).onchange = e => { st.date = e.target.value || today(); draw(); };
      $('#qa-time', s).onchange = e => { st.time = e.target.value; };
      $('#qa-kind', s).onclick = e => { const b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.kind; st.kindTouched = true; haptic(); draw(); };
      $('#qa-q', s).oninput = e => { st.q = e.target.value; draw(); };
      $('#qa-chips', s).onclick = e => {
        const b = e.target.closest('.chip'); if (!b) return; haptic();
        if (b.dataset.new) {
          const c = createClient({ name: st.q.trim() });
          st.sel.add(c.id); st.q = ''; $('#qa-q', s).value = ''; draw(); refresh(); return;
        }
        const id = b.dataset.cid;
        if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id);
        if (!st.kindTouched && st.sel.size === 1) { const c = getClient([...st.sel][0]); if (c && c.lastKind) st.kind = c.lastKind; }
        draw();
      };
      $('#qa-save', s).onclick = () => {
        if (!st.sel.size) return;
        const created = [];
        for (const id of st.sel) {
          const s1 = { id: uid(), clientId: id, date: st.date, time: st.time || '', kind: st.kind, note: '', createdAt: Date.now() };
          const willPass = passForNew(id, st.kind, st.date);
          if (!willPass) s1.unitPrice = singlePrice(st.kind);
          db.sessions.push(s1); created.push(s1.id);
          const c = getClient(id); if (c) c.lastKind = st.kind;
          cache = null;
        }
        save(); haptic(15); closeSheet();
        if (state.tab === 'calendar') { state.selDate = st.date; state.calMonth = mkey(st.date); }
        refresh();
        toast(created.length > 1 ? `${created.length} alkalom rögzítve` : 'Alkalom rögzítve', {
          action: 'Visszavonás', onAction: () => { db.sessions = db.sessions.filter(x => !created.includes(x.id)); save(); refresh(); }
        });
      };
      draw();
    }
  });
}

/* ---------------- Sheets: mark days (tömeges utólagos jelölés) ---------------- */
function markDays(cid) {
  const c = getClient(cid); if (!c) return;
  const st = { mk: mkey(today()), kind: c.lastKind || 'szemelyi' };
  openSheet(`<div class="sheet-head"><div><h2>Napok jelölése</h2><p>${esc(c.name)} – bökj azokra a napokra, amikor itt volt</p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <div class="seg k" id="md-kind">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}">${v.label}</button>`).join('')}</div>
      <div class="card cal-card" id="md-card" style="padding:12px 10px">
        <div class="cal-head"><div class="m" id="md-m" style="font-size:24px"></div>
          <div class="cal-nav"><button class="icon-btn" id="md-prev">${ic.left}</button><button class="icon-btn" id="md-next">${ic.right}</button></div></div>
        <div id="md-grid"></div>
      </div>
      <p class="hint" id="md-info"></p>
      <button class="btn primary block" data-action="close-sheet">${ic.check} Kész</button>
    </div>`, {
    onMount: s => {
      const draw = (dir = 0) => {
        const [y, m] = st.mk.split('-').map(Number);
        $('#md-m', s).innerHTML = `${MONTHS[m - 1]} <span style="color:var(--muted);font-weight:600">${y}</span>`;
        const mine = new Set(clientSessions(cid).filter(x => x.kind === st.kind).map(x => x.date));
        const other = new Set(clientSessions(cid).filter(x => x.kind !== st.kind).map(x => x.date));
        $('#md-grid', s).innerHTML = calGrid(st.mk, (date, out) => {
          const cls = ['day', out && 'out', mine.has(date) && 'on', !mine.has(date) && other.has(date) && 'has', date === today() && 'today'].filter(Boolean).join(' ');
          return `<button class="${cls}" data-date="${date}"><span>${Number(date.slice(8))}</span></button>`;
        }).replace('class="cal-grid"', `class="cal-grid ${dir === 1 ? 'slide-l' : dir === -1 ? 'slide-r' : ''}"`);
        $$('#md-kind button', s).forEach(b => b.classList.toggle('on', b.dataset.kind === st.kind));
        const n = clientSessions(cid).filter(x => mkey(x.date) === st.mk).length;
        $('#md-info', s).textContent = `${fmtMonth(st.mk)}: ${n} alkalom. A bérletek automatikusan levonják a beléjük eső napokat.`;
      };
      $('#md-prev', s).onclick = () => { st.mk = shiftMonth(st.mk, -1); draw(-1); };
      $('#md-next', s).onclick = () => { st.mk = shiftMonth(st.mk, 1); draw(1); };
      $('#md-kind', s).onclick = e => { const b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.kind; draw(); };
      let x0 = null;
      $('#md-card', s).addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      $('#md-card', s).addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) { st.mk = shiftMonth(st.mk, dx < 0 ? 1 : -1); draw(dx < 0 ? 1 : -1); } }, { passive: true });
      $('#md-grid', s).onclick = e => {
        const b = e.target.closest('.day'); if (!b) return;
        const date = b.dataset.date;
        const ex = clientSessions(cid).find(x => x.date === date && x.kind === st.kind);
        if (ex) db.sessions = db.sessions.filter(x => x.id !== ex.id);
        else {
          const s1 = { id: uid(), clientId: cid, date, time: '', kind: st.kind, note: '', createdAt: Date.now() };
          if (!passForNew(cid, st.kind, date)) s1.unitPrice = singlePrice(st.kind);
          db.sessions.push(s1);
        }
        c.lastKind = st.kind;
        haptic(ex ? 6 : 12); save(); draw(); refresh();
      };
      draw();
    }
  });
}

/* ---------------- Sheets: fix időpont (ismétlődő alkalmak) ---------------- */
// schedule = { slots: { 1: '16:00', 3: '15:00', ... }, kind }  (1 = hétfő … 7 = vasárnap)
function getSched(c) {
  const sc = c && c.schedule; if (!sc) return null;
  let slots = sc.slots;
  if (!slots && Array.isArray(sc.days)) { slots = {}; sc.days.forEach(d => { slots[d] = sc.time || ''; }); } // régi formátum
  if (!slots || !Object.keys(slots).length) return null;
  return { slots, kind: sc.kind || 'szemelyi' };
}
const schedDays = sch => Object.keys(sch.slots).map(Number).sort((a, b) => a - b);
function schedLabel(sch, short = false) {
  const days = schedDays(sch), times = [...new Set(days.map(d => sch.slots[d]))];
  const name = d => short ? WD_S[d - 1] : WD_LONG_MON[d - 1];
  if (times.length === 1) return `${days.map(name).join(', ')}${times[0] ? ' ' + times[0] : ''}`;
  return days.map(d => `${name(d)} ${sch.slots[d] || ''}`.trim()).join(short ? ' · ' : ', ');
}
function scheduleDates(sch, start, count, cid) {
  const out = [], skipped = [];
  let date = start, guard = 0;
  const existing = new Set(clientSessions(cid).filter(s => s.kind === sch.kind).map(s => s.date));
  while (out.length < count && guard++ < 800) {
    const wd = isoWd(date);
    if (sch.slots[wd] !== undefined) { if (existing.has(date)) skipped.push(date); else out.push({ date, time: sch.slots[wd] || '' }); }
    date = addDays(date, 1);
  }
  return { dates: out, skipped };
}
function scheduleSheet(cid) {
  const c = getClient(cid); if (!c) return;
  const prev = getSched(c);
  const fut = (derived().planned.get(cid) || []);
  const futPlanned = fut.filter(s => s.planned);
  const st = { slots: prev ? { ...prev.slots } : {}, kind: prev ? prev.kind : (c.lastKind || 'szemelyi'), lastTime: '16:00' };
  if (prev) { const ts = Object.values(prev.slots).filter(Boolean); if (ts.length) st.lastTime = ts[ts.length - 1]; }
  const defStart = () => { const last = fut.filter(s => s.kind === st.kind).pop(); return last ? addDays(last.date, 1) : today(); };
  const defCount = () => {
    const p = clientPasses(cid).find(x => x.cat === st.kind && ['active', 'future'].includes(passStatus(x)));
    if (p) { const left = p.sessions - (derived().passUsed.get(p.id) || 0); if (left > 0) return left; }
    return 12;
  };
  openSheet(`<div class="sheet-head"><div><h2>Fix időpont</h2><p>${esc(c.name)} – rendszeres alkalmak előre a naptárba</p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <div class="field"><span>Melyik napokon?</span><div class="seg days" id="sc-days">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button data-d="${d}">${WD_S[d - 1]}</button>`).join('')}</div></div>
      <div class="field"><span>Időpontok <em>– naponként eltérhet</em></span><div class="slot-list" id="sc-times"></div></div>
      <div class="field-row even">
        <label class="field"><span>Hány alkalom előre?</span><input type="number" inputmode="numeric" id="sc-n" min="1" max="60" value="${defCount()}"></label>
        <label class="field"><span>Kezdés</span><input type="date" id="sc-start" value="${defStart()}"></label>
      </div>
      <div class="seg k" id="sc-kind">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}">${v.label}</button>`).join('')}</div>
      <div class="receipt" id="sc-prev"></div>
      <button class="btn primary block" id="sc-go">${ic.calCheck} Beírás a naptárba</button>
      <button class="btn block" id="sc-save">Csak a beállítás mentése</button>
      ${futPlanned.length ? `<button class="btn danger block" id="sc-clear">${ic.trash} Előre beírt alkalmak törlése (${futPlanned.length})</button>` : ''}
      <p class="hint">Ha valaki lemond egy alkalmat, bökj rá a naptárban → <b>Lemondta</b>. A tervezett alkalmak csak az adott napon számítanak bele a statisztikába és az elszámolásba.</p>
    </div>`, {
    onMount: s => {
      const drawTimes = () => {
        const days = Object.keys(st.slots).map(Number).sort((a, b) => a - b);
        $('#sc-times', s).innerHTML = days.length ? days.map(d => `<label class="slot-row"><span>${WD_LONG_MON[d - 1]}</span><input type="time" step="300" data-d="${d}" value="${st.slots[d] || ''}"></label>`).join('')
          : '<div class="hint" style="margin:0 4px">Előbb jelöld ki fent a napokat.</div>';
      };
      const draw = () => {
        $$('#sc-days button', s).forEach(b => b.classList.toggle('on', st.slots[b.dataset.d] !== undefined));
        $$('#sc-kind button', s).forEach(b => b.classList.toggle('on', b.dataset.kind === st.kind));
        const n = Math.max(1, Math.min(60, Number($('#sc-n', s).value) || 0));
        const start = $('#sc-start', s).value || today();
        const box = $('#sc-prev', s), go = $('#sc-go', s);
        if (!Object.keys(st.slots).length) { box.innerHTML = '<div class="dates" style="padding:4px 0">Jelöld ki, melyik napokon jön.</div>'; go.disabled = true; go.innerHTML = `${ic.calCheck} Beírás a naptárba`; return; }
        const sch = { slots: st.slots, kind: st.kind };
        const { dates, skipped } = scheduleDates(sch, start, n, cid);
        const p = passForNew(cid, st.kind, dates[0] ? dates[0].date : start);
        box.innerHTML = `<div class="line"><span>Minden</span><b>${esc(schedLabel(sch))}</b></div>
          <div class="line"><span>${dates.length} alkalom</span><b>${dates.length ? `${fmtDay(dates[0].date)} – ${fmtDay(dates[dates.length - 1].date)}` : '–'}</b></div>
          ${skipped.length ? `<div class="line"><span>Már beírva, kihagyja</span><b>${skipped.length} nap</b></div>` : ''}
          <div class="dates" style="padding-top:8px">${p ? `A ${esc(p.name)} bérletből vonódnak le, ameddig van benne alkalom.` : `Nincs bérlet erre az időszakra – alkalmi áron számolódnak (${ft(singlePrice(st.kind))}).`}</div>`;
        go.disabled = !dates.length;
        go.innerHTML = `${ic.calCheck} ${dates.length} alkalom beírása`;
      };
      const saveSched = () => {
        const slots = {}; Object.keys(st.slots).map(Number).sort((a, b) => a - b).forEach(d => { slots[d] = st.slots[d] || ''; });
        c.schedule = { slots, kind: st.kind };
        c.lastKind = st.kind;
      };
      $('#sc-days', s).onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        const d = b.dataset.d;
        if (st.slots[d] !== undefined) delete st.slots[d]; else st.slots[d] = st.lastTime;
        haptic(); drawTimes(); draw();
      };
      $('#sc-times', s).addEventListener('input', e => {
        const i = e.target.closest('input[data-d]'); if (!i) return;
        st.slots[i.dataset.d] = i.value; if (i.value) st.lastTime = i.value; draw();
      });
      $('#sc-times', s).addEventListener('change', e => { const i = e.target.closest('input[data-d]'); if (i) { st.slots[i.dataset.d] = i.value; if (i.value) st.lastTime = i.value; draw(); } });
      $('#sc-kind', s).onclick = e => { const b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.kind; $('#sc-start', s).value = defStart(); $('#sc-n', s).value = defCount(); draw(); };
      ['#sc-n', '#sc-start'].forEach(q => { $(q, s).oninput = draw; $(q, s).onchange = draw; });
      $('#sc-save', s).onclick = () => {
        if (!Object.keys(st.slots).length) { toast('Jelölj ki legalább egy napot'); return; }
        saveSched(); save(); closeSheet(); refresh(); toast('Fix időpont mentve');
      };
      $('#sc-go', s).onclick = () => {
        if (!Object.keys(st.slots).length) return;
        saveSched();
        const sch = getSched(c);
        const n = Math.max(1, Math.min(60, Number($('#sc-n', s).value) || 1));
        const { dates } = scheduleDates(sch, $('#sc-start', s).value || today(), n, cid);
        const created = [];
        for (const { date, time } of dates) {
          const s1 = { id: uid(), clientId: cid, date, time, kind: sch.kind, note: '', planned: true, unitPrice: singlePrice(sch.kind), createdAt: Date.now() };
          db.sessions.push(s1); created.push(s1.id);
        }
        save(); haptic(20); closeSheet(); refresh();
        toast(`${created.length} alkalom beírva (${fmtDay(dates[0].date)} – ${fmtDay(dates[dates.length - 1].date)})`, {
          action: 'Visszavonás', onAction: () => { db.sessions = db.sessions.filter(x => !created.includes(x.id)); save(); refresh(); }
        });
      };
      const clr = $('#sc-clear', s);
      if (clr) clr.onclick = async () => {
        if (!await confirmDialog({ title: 'Előre beírt alkalmak törlése?', text: `${futPlanned.length} jövőbeli, fix időpontból beírt alkalom törlődik. A múltbeliek megmaradnak.`, ok: 'Törlés', danger: true })) return;
        const ids = new Set(futPlanned.map(x => x.id));
        const removed = db.sessions.filter(x => ids.has(x.id) && isPlanned(x));
        db.sessions = db.sessions.filter(x => !(ids.has(x.id) && isPlanned(x)));
        save(); closeSheet(); setTimeout(() => { refresh(); toast(`${removed.length} tervezett alkalom törölve`, { action: 'Visszavonás', onAction: () => { db.sessions.push(...removed); save(); refresh(); } }); }, 150);
      };
      drawTimes(); draw();
    }
  });
}

/* ---------------- Sheets: session ---------------- */
function sessionSheet(id) {
  const s0 = db.sessions.find(x => x.id === id); if (!s0) return;
  const c = getClient(s0.clientId) || { name: 'Törölt kliens', color: '#888' };
  const st = { ...s0 };
  const pid = derived().sessionPass.get(id), p = pid && derived().passMap.get(pid);
  openSheet(`<div class="sheet-head"><div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="--c:${c.color}">${esc(initials(c.name))}</span>
      <div><h2 style="font-size:24px">${esc(c.name)}</h2><p>${isPlanned(s0) ? 'Tervezett · ' : ''}${p ? `Bérletből · ${esc(p.name)}` : `Alkalmi · ${ft(sessionValue(s0))}`}</p></div></div>
      <button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <div class="field-row"><label class="field"><span>Dátum</span><input type="date" id="ss-date" value="${st.date}"></label>
        <label class="field"><span>Időpont</span><input type="time" id="ss-time" value="${st.time || ''}" step="300"></label></div>
      <div class="seg k" id="ss-kind">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}" class="${k === st.kind ? 'on' : ''}">${v.label}</button>`).join('')}</div>
      <label class="field"><span>Megjegyzés</span><input type="text" id="ss-note" value="${esc(st.note || '')}" placeholder="pl. láb nap, késett 10 percet…"></label>
      ${!p ? `<label class="field"><span>Alkalmi ár</span><input type="number" inputmode="numeric" id="ss-price" value="${sessionValue(s0)}"></label>` : ''}
      <div class="btn-row"><button class="btn danger" id="ss-del">${ic.trash} ${isPlanned(s0) ? 'Lemondta' : 'Törlés'}</button><button class="btn primary" id="ss-save">${ic.check} Mentés</button></div>
      ${getClient(s0.clientId) ? `<button class="btn block" style="background:none;border:0;color:var(--accent-2)" id="ss-client">Kliens adatlapja →</button>` : ''}
    </div>`, {
    onMount: s => {
      $('#ss-kind', s).onclick = e => { const b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.kind; $$('#ss-kind button', s).forEach(x => x.classList.toggle('on', x === b)); };
      $('#ss-save', s).onclick = () => {
        const t = db.sessions.find(x => x.id === id); if (!t) return;
        t.date = $('#ss-date', s).value || t.date; t.time = $('#ss-time', s).value; t.note = $('#ss-note', s).value.trim();
        if (t.kind !== st.kind) { t.kind = st.kind; if (!$('#ss-price', s)) t.unitPrice = singlePrice(st.kind); }
        const pr = $('#ss-price', s); if (pr && pr.value !== '') t.unitPrice = Math.max(0, Number(pr.value));
        save(); closeSheet(); refresh(); toast('Mentve');
      };
      $('#ss-del', s).onclick = () => {
        const t = db.sessions.find(x => x.id === id); if (!t) return;
        db.sessions = db.sessions.filter(x => x.id !== id); save(); closeSheet(); refresh(); haptic(15);
        toast(isPlanned(t) ? 'Alkalom lemondva' : 'Alkalom törölve', { action: 'Visszavonás', onAction: () => { db.sessions.push(t); save(); refresh(); } });
      };
      const cb = $('#ss-client', s);
      if (cb) cb.onclick = () => { closeSheet(); setTimeout(() => openClient(s0.clientId), 200); };
    }
  });
}

/* ---------------- Sheets: client form ---------------- */
function createClient({ name, phone = '', note = '', color }) {
  const used = new Set(db.clients.map(c => c.color));
  const c = { id: uid(), name: name.trim(), phone, note, color: color || COLORS.find(x => !used.has(x)) || COLORS[db.clients.length % COLORS.length], lastKind: 'szemelyi', createdAt: Date.now() };
  db.clients.push(c); save();
  return c;
}
function clientForm(id, opts = {}) {
  const c = id ? getClient(id) : null;
  const st = { color: c ? c.color : (COLORS.find(x => !db.clients.some(k => k.color === x)) || COLORS[0]) };
  openSheet(`<div class="sheet-head"><div><h2>${c ? 'Kliens szerkesztése' : 'Új kliens'}</h2></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <label class="field"><span>Név</span><input type="text" id="cf-name" value="${esc(c ? c.name : (opts.name || ''))}" placeholder="pl. Kovács Anna" autocomplete="off" autocapitalize="words"></label>
      <label class="field"><span>Telefon <em>(nem kötelező)</em></span><input type="tel" id="cf-phone" value="${esc(c ? c.phone : '')}" placeholder="+36 30 123 4567"></label>
      <label class="field"><span>Megjegyzés <em>(nem kötelező)</em></span><input type="text" id="cf-note" value="${esc(c ? c.note : '')}" placeholder="pl. hétfő-szerda 17:00"></label>
      <div class="field"><span>Szín a naptárban</span><div class="swatches" id="cf-col">${COLORS.map(x => `<button class="swatch ${x === st.color ? 'on' : ''}" style="--c:${x}" data-c="${x}" aria-label="szín"></button>`).join('')}</div></div>
      <button class="btn primary block" id="cf-save">${ic.check} ${c ? 'Mentés' : 'Kliens felvétele'}</button>
      ${c ? `<button class="btn danger block" id="cf-del">${ic.trash} Kliens törlése</button>` : ''}
    </div>`, {
    onMount: s => {
      setTimeout(() => { if (!c) $('#cf-name', s).focus(); }, 350);
      $('#cf-col', s).onclick = e => { const b = e.target.closest('.swatch'); if (!b) return; st.color = b.dataset.c; $$('.swatch', s).forEach(x => x.classList.toggle('on', x === b)); haptic(); };
      $('#cf-save', s).onclick = () => {
        const name = $('#cf-name', s).value.trim();
        if (!name) { $('#cf-name', s).focus(); toast('Add meg a nevet'); return; }
        const phone = $('#cf-phone', s).value.trim(), note = $('#cf-note', s).value.trim();
        let target;
        if (c) { Object.assign(c, { name, phone, note, color: st.color }); save(); target = c; }
        else target = createClient({ name, phone, note, color: st.color });
        closeSheet(); refresh(); toast(c ? 'Mentve' : `${name} felvéve`);
        if (opts.thenAdd) setTimeout(() => quickAdd({ clientIds: [target.id] }), 250);
      };
      const del = $('#cf-del', s);
      if (del) del.onclick = async () => {
        const n = clientSessions(c.id).length;
        const ok = await confirmDialog({ title: `${c.name} törlése?`, text: n ? `${n} rögzített alkalma és a bérletei is törlődnek. Ez nem vonható vissza.` : 'Ez nem vonható vissza.', ok: 'Törlés', danger: true });
        if (!ok) return;
        db.clients = db.clients.filter(x => x.id !== c.id);
        db.sessions = db.sessions.filter(x => x.clientId !== c.id);
        db.passes = db.passes.filter(x => x.clientId !== c.id);
        save(); closeSheet(); setTimeout(() => { if (pages.length) closePage(); refresh(); toast('Kliens törölve'); }, 150);
      };
    }
  });
}

/* ---------------- Sheets: pass ---------------- */
function passForm(cid, passId) {
  const c = getClient(cid); if (!c) return;
  const p = passId ? db.passes.find(x => x.id === passId) : null;
  const options = db.services.filter(x => !x.single);
  const first = p ? null : options[0];
  const st = p ? { ...p } : { serviceId: first.id, name: first.name, cat: first.cat, sessions: first.sessions, price: first.price, start: today(), end: addDays(today(), first.days - 1), paid: false, note: '' };
  const used = p ? (derived().passDone.get(p.id) || 0) : 0;
  openSheet(`<div class="sheet-head"><div><h2>${p ? 'Bérlet' : 'Új bérlet'}</h2><p>${esc(c.name)}${p ? ` · ${used}/${p.sessions} felhasználva` : ''}</p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      ${p ? '' : `<label class="field"><span>Típus</span><select id="pf-svc">${options.map(o => `<option value="${o.id}">${esc(o.name)} – ${ft(o.price)}</option>`).join('')}</select></label>`}
      ${p ? `<div class="card" style="padding:14px"><b>${esc(p.name)}</b><div class="meter"><i style="width:${Math.min(100, used / p.sessions * 100)}%"></i></div></div>` : ''}
      <div class="field-row even"><label class="field"><span>Kezdete</span><input type="date" id="pf-start" value="${st.start}"></label>
        <label class="field"><span>Érvényes eddig</span><input type="date" id="pf-end" value="${st.end}"></label></div>
      <div class="field-row even"><label class="field"><span>Alkalmak</span><input type="number" inputmode="numeric" id="pf-n" value="${st.sessions}" min="1"></label>
        <label class="field"><span>Ár (Ft)</span><input type="number" inputmode="numeric" id="pf-price" value="${st.price}"></label></div>
      <div class="switch-row"><div><b>Kifizetve / számlázva</b><div class="hint" style="margin:2px 0 0">Ha be van kapcsolva, nem kerül a havi számlázandó összegbe.</div></div><label class="switch"><input type="checkbox" id="pf-paid" ${st.paid ? 'checked' : ''}><i></i></label></div>
      <p class="hint">A kezdő dátumtól eső alkalmak (a korábban rögzítettek is) automatikusan ebből a bérletből vonódnak le.</p>
      <button class="btn primary block" id="pf-save">${ic.check} ${p ? 'Mentés' : 'Bérlet felvétele'}</button>
      ${p ? `<button class="btn danger block" id="pf-del">${ic.trash} Bérlet törlése</button>` : ''}
    </div>`, {
    onMount: s => {
      const sel = $('#pf-svc', s);
      if (sel) sel.onchange = () => {
        const o = svc(sel.value);
        st.serviceId = o.id; st.name = o.name; st.cat = o.cat;
        $('#pf-n', s).value = o.sessions; $('#pf-price', s).value = o.price;
        $('#pf-end', s).value = addDays($('#pf-start', s).value || today(), o.days - 1);
      };
      $('#pf-start', s).onchange = e => {
        if (p) return;
        const o = svc(st.serviceId); if (o && e.target.value) $('#pf-end', s).value = addDays(e.target.value, o.days - 1);
      };
      $('#pf-save', s).onclick = () => {
        const start = $('#pf-start', s).value, end = $('#pf-end', s).value;
        if (!start || !end || end < start) { toast('Ellenőrizd a dátumokat'); return; }
        const data = { start, end, sessions: Math.max(1, Number($('#pf-n', s).value) || 1), price: Math.max(0, Number($('#pf-price', s).value) || 0), paid: $('#pf-paid', s).checked };
        if (p) Object.assign(p, data);
        else db.passes.push({ id: uid(), clientId: cid, serviceId: st.serviceId, name: st.name, cat: st.cat, note: '', createdAt: Date.now(), ...data });
        save(); closeSheet(); refresh(); haptic(15); toast(p ? 'Bérlet mentve' : 'Bérlet felvéve');
      };
      const del = $('#pf-del', s);
      if (del) del.onclick = async () => {
        if (!await confirmDialog({ title: 'Bérlet törlése?', text: 'Az alkalmak megmaradnak, csak alkalminak számítanak majd.', ok: 'Törlés', danger: true })) return;
        db.passes = db.passes.filter(x => x.id !== p.id); save(); closeSheet(); setTimeout(() => { refresh(); toast('Bérlet törölve'); }, 150);
      };
    }
  });
}

/* ---------------- Sheets: billing detail ---------------- */
function billText(c, mk, b) {
  const L = [`ReBeFit Team – elszámolás`, `Kliens: ${c.name}`, `Időszak: ${fmtMonth(mk)}`, ''];
  for (const l of b.singleLines) {
    L.push(`${KINDS[l.kind].long} (alkalmi): ${l.count} × ${l.unit != null ? ft(l.unit) : 'vegyes ár'} = ${ft(l.total)}`);
    L.push(`   ${l.dates.map(fmtDay).join(', ')}`);
  }
  for (const l of b.passLines) {
    L.push(`${l.pass.name} (${fmtDay(l.pass.start)}–${fmtDay(l.pass.end)}): ${l.count} alkalom ebben a hónapban, összesen ${l.used}/${l.pass.sessions}`);
    L.push(`   ${l.dates.map(fmtDay).join(', ')}`);
  }
  for (const p of b.sold) L.push(`Új bérlet: ${p.name} – ${ft(p.price)}${p.paid ? ' (már fizetve)' : ''}`);
  L.push('', `Alkalmak összesen: ${b.sess.length}`, `Számlázandó: ${ft(b.due)}`);
  return L.join('\n').replace(/ /g, ' ');
}
function billSheet(cid, mk = state.billMonth) {
  const c = getClient(cid); if (!c) return;
  const st = { mk };
  openSheet(`<div id="bs"></div>`, {
    onMount: s => {
      const draw = () => {
        const b = billingFor(cid, st.mk);
        $('#bs', s).innerHTML = `<div class="sheet-head"><div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="--c:${c.color}">${esc(initials(c.name))}</span>
            <div><h2 style="font-size:24px">${esc(c.name)}</h2><p>${b.sess.length} alkalom</p></div></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
          <div class="cal-head" style="margin-bottom:12px"><div class="m" style="font-size:22px">${fmtMonth(st.mk)}</div>
            <div class="cal-nav"><button class="icon-btn" id="bs-prev">${ic.left}</button><button class="icon-btn" id="bs-next">${ic.right}</button></div></div>
          <div class="receipt">
            ${b.singleLines.map(l => `<div class="line"><span>${KINDS[l.kind].long} · alkalmi</span><b>${l.count} × ${l.unit != null ? ft(l.unit) : 'vegyes'}<br>${ft(l.total)}</b></div>
              <div class="dates">${l.dates.map(fmtDay).join(' · ')}</div>`).join('')}
            ${b.passLines.map(l => `<div class="line"><span>${esc(l.pass.name)}</span><b>${l.count} alkalom<br><small style="color:var(--muted);font-weight:500">összesen ${l.used}/${l.pass.sessions}</small></b></div>
              <div class="dates">${l.dates.map(fmtDay).join(' · ')}</div>`).join('')}
            ${b.sold.map(p => `<div class="line"><span>Új bérlet: ${esc(p.name)}</span><b>${ft(p.price)}${p.paid ? '<br><small style="color:var(--ok)">fizetve</small>' : ''}</b></div>`).join('')}
            ${!b.sess.length && !b.sold.length ? '<div class="dates" style="padding:6px 0">Ebben a hónapban még nincs elszámolható tétel.</div>' : ''}
            ${b.planned.length ? `<div class="line"><span>Tervezett, még nem számít bele</span><b>${b.planned.length} alkalom</b></div><div class="dates">${b.planned.map(s => fmtDay(s.date)).join(' · ')}</div>` : ''}
            <div class="total"><span class="lbl">Számlázandó</span><b>${ft(b.due)}</b></div>
          </div>
          ${b.tip ? `<div class="tip">${esc(b.tip)}</div>` : ''}
          <div class="switch-row" style="margin-top:14px"><div><b>Számla kiállítva</b><div class="hint" style="margin:2px 0 0">Megjelölöd, hogy erre a hónapra már számláztál.</div></div><label class="switch"><input type="checkbox" id="bs-billed" ${b.billed ? 'checked' : ''}><i></i></label></div>
          <div class="btn-row" style="margin-top:14px"><button class="btn" id="bs-client">${ic.user} Adatlap</button><button class="btn primary" id="bs-copy">${ic.copy} Másolás</button></div>`;
        $('#bs-prev', s).onclick = () => { st.mk = shiftMonth(st.mk, -1); draw(); };
        $('#bs-next', s).onclick = () => { st.mk = shiftMonth(st.mk, 1); draw(); };
        $('#bs-billed', s).onchange = e => { const k = cid + '|' + st.mk; if (e.target.checked) db.billing[k] = new Date().toISOString(); else delete db.billing[k]; haptic(12); save(); refresh(); };
        $('#bs-copy', s).onclick = async () => {
          const txt = billText(c, st.mk, b);
          try { await navigator.clipboard.writeText(txt); toast('Kimásolva – beillesztheted a számlázóba'); }
          catch (e) { if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast('Nem sikerült másolni'); }
        };
        $('#bs-client', s).onclick = () => { closeSheet(); if (!pages.length) setTimeout(() => openClient(cid), 200); };
      };
      draw();
    }
  });
}

/* ---------------- Settings / backup ---------------- */
function settingsSheet() {
  const s0 = db.settings;
  const last = s0.lastBackup ? new Date(s0.lastBackup) : null;
  openSheet(`<div class="sheet-head"><div><h2>Beállítások</h2><p>ReBeFit Napló · v${APP_VERSION}</p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="stack">
      <div class="section-h" style="margin:4px 4px 0"><h2>Mentés</h2></div>
      <div class="set-group">
        <button class="set-row" data-action="backup"><span class="si">${ic.download}</span><span class="row-main"><b>Mentés készítése</b><small>${last ? 'Utolsó: ' + last.toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Még nem volt mentés'}${s0.changes ? ` · ${s0.changes} új változás` : ' · minden mentve'}</small></span></button>
        <button class="set-row" data-action="import"><span class="si">${ic.upload}</span><span class="row-main"><b>Visszaállítás mentésből</b><small>Egy korábbi .json mentés betöltése</small></span></button>
        ${localStorage.getItem(PREV_KEY) ? `<button class="set-row" data-action="undo-import"><span class="si">${ic.clock}</span><span class="row-main"><b>Visszaállítás előtti állapot</b><small>Ha véletlenül rossz mentést töltöttél vissza</small></span></button>` : ''}
      </div>
      <div class="section-h" style="margin:14px 4px 0"><h2>Általános</h2></div>
      <div class="set-group">
        <button class="set-row" data-action="check-update"><span class="si">${ic.download}</span><span class="row-main"><b>${swWaiting ? 'Frissítés telepítése' : 'Frissítés keresése'}</b><small>${swWaiting ? 'Új verzió letöltve – bökj ide az újraindításhoz' : `Jelenlegi verzió: v${APP_VERSION}`}</small></span>${swWaiting ? '<span class="badge-dot" style="position:static;box-shadow:0 0 10px var(--accent)"></span>' : ''}</button>
        <button class="set-row" data-action="prices"><span class="si">${ic.tag}</span><span class="row-main"><b>Árlista</b><small>Alkalmi és bérlet árak módosítása</small></span><span class="chev">${ic.right}</span></button>
        <div class="set-row"><span class="si">${ic.user}</span><span class="row-main"><b>Megszólítás</b></span><input class="input" id="st-name" value="${esc(s0.name)}" style="max-width:150px;min-height:40px;text-align:right"></div>
        <div class="set-row" style="flex-wrap:wrap"><span class="si">${ic.moon}</span><span class="row-main"><b>Megjelenés</b></span>
          <div class="seg" id="st-theme" style="width:100%">${[['auto', 'Auto'], ['dark', 'Sötét'], ['light', 'Világos']].map(([k, v]) => `<button data-t="${k}" class="${s0.theme === k ? 'on' : ''}" style="height:34px;font-size:13px">${v}</button>`).join('')}</div></div>
      </div>
      <div class="set-group" style="margin-top:14px">
        <button class="set-row" data-action="demo"><span class="si">${ic.sparkle}</span><span class="row-main"><b>Bemutató adatok</b><small>Kitalált kliensek a kipróbáláshoz (a mostaniak mellé)</small></span></button>
        <button class="set-row danger" data-action="wipe"><span class="si">${ic.trash}</span><span class="row-main"><b>Összes adat törlése</b><small>Előtte készíts mentést!</small></span></button>
      </div>
      <p class="hint" style="text-align:center;margin-top:16px">Minden adat csak ezen a telefonon van. A mentés az egyetlen biztonsági másolat – tartsd a „ReBeFit mentések” mappában.</p>
    </div>`, {
    onMount: s => {
      $('#st-name', s).onchange = e => { db.settings.name = e.target.value.trim() || 'Rebeka'; save(false); refresh(); };
      $('#st-theme', s).onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        db.settings.theme = b.dataset.t; save(false); applyTheme();
        $$('#st-theme button', s).forEach(x => x.classList.toggle('on', x === b));
      };
    }
  });
}
function applyTheme() {
  const t = db.settings.theme;
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
function pricesSheet() {
  openSheet(`<div class="sheet-head"><div><h2>Árlista</h2><p>Új alkalmakra és bérletekre érvényes – a régiek megtartják az árukat</p></div><button class="icon-btn" data-action="close-sheet">${ic.close}</button></div>
    <div class="card" style="padding:4px 16px">${db.services.map(o => `<div class="price-row"><label for="pr-${o.id}">${esc(o.name)}</label><input class="input" type="number" inputmode="numeric" id="pr-${o.id}" data-id="${o.id}" value="${o.price}"></div>`).join('')}</div>
    <button class="btn primary block" id="pr-save" style="margin-top:14px">${ic.check} Mentés</button>
    <button class="btn block" id="pr-reset" style="margin-top:10px;background:none;border:0;color:var(--muted)">Alapárak visszaállítása (2026.01.01-es árlista)</button>`, {
    onMount: s => {
      $('#pr-save', s).onclick = () => {
        $$('input[data-id]', s).forEach(i => { const o = svc(i.dataset.id); if (o && i.value !== '') o.price = Math.max(0, Number(i.value)); });
        save(); closeSheet(); refresh(); toast('Árlista mentve');
      };
      $('#pr-reset', s).onclick = () => { DEFAULT_SERVICES.forEach(d => { const i = $(`#pr-${d.id}`, s); if (i) i.value = d.price; }); };
    }
  });
}

async function exportBackup() {
  const now = new Date();
  const payload = { app: 'rebefit-naplo', format: 1, appVersion: APP_VERSION, exportedAt: now.toISOString(), data: db };
  const json = JSON.stringify(payload, null, 1);
  const name = `rebefit-mentes-${iso(now)}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
  const done = () => { db.settings.lastBackup = new Date().toISOString(); db.settings.changes = 0; save(false); refresh(); toast('Mentés kész ✓'); };
  let file;
  try { file = new File([json], name, { type: 'application/json' }); } catch (e) { file = null; }
  if (file && isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'ReBeFit mentés' }); done(); return; }
    catch (e) { if (e && e.name === 'AbortError') { toast('Mentés megszakítva'); return; } }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  done();
}
function startImport() { const inp = $('#import-input'); inp.value = ''; inp.click(); }
$('#import-input').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  let data;
  try { const j = JSON.parse(await f.text()); data = j && j.app === 'rebefit-naplo' ? j.data : j; if (!data || !Array.isArray(data.clients) || !Array.isArray(data.sessions)) throw new Error('format'); }
  catch (err) { toast('Ez nem ReBeFit mentésfájl'); return; }
  const ok = await confirmDialog({ title: 'Visszaállítás?', text: `A mentésben ${data.clients.length} kliens és ${data.sessions.length} alkalom van. A telefonon lévő jelenlegi adatok (${db.clients.length} kliens, ${db.sessions.length} alkalom) lecserélődnek.`, ok: 'Visszaállítás' });
  if (!ok) return;
  try { localStorage.setItem(PREV_KEY, JSON.stringify(db)); } catch (err) {}
  db = migrate(data); db.settings.changes = 0; db.settings.lastBackup = db.settings.lastBackup || new Date().toISOString();
  save(false); applyTheme();
  while ($$('.sheet-wrap:not(.closing)').length) closeSheet();
  while (pages.length) closePage();
  setTimeout(() => { render(true); toast('Visszaállítva ✓'); }, 200);
});

function loadDemo() {
  const names = ['Kovács Anna', 'Nagy Petra', 'Szabó Dóra', 'Tóth Eszter', 'Horváth Lili', 'Varga Bence', 'Kiss Noémi'];
  const t = today();
  const made = names.map(n => createClient({ name: n }));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const times = ['07:00', '08:00', '09:30', '16:00', '17:00', '18:00', '19:00'];
  made.forEach((c, i) => {
    const kind = i === 4 || i === 6 ? 'pozo' : i === 5 ? 'vip' : 'szemelyi';
    c.lastKind = kind;
    if (i < 3) { // bérletesek
      const start = addDays(t, -rnd(8, 20));
      const o = svc(i === 1 ? 'pt12' : 'pt8');
      db.passes.push({ id: uid(), clientId: c.id, serviceId: o.id, name: o.name, cat: o.cat, sessions: o.sessions, price: o.price, start, end: addDays(start, o.days - 1), paid: i !== 2, note: '', createdAt: Date.now() });
    }
    if (i === 4) { const start = addDays(t, -40); const o = svc('pole10'); db.passes.push({ id: uid(), clientId: c.id, serviceId: o.id, name: o.name, cat: o.cat, sessions: o.sessions, price: o.price, start, end: addDays(start, o.days - 1), paid: true, note: '', createdAt: Date.now() }); }
    for (let d = -75; d <= 0; d++) {
      const date = addDays(t, d), wd = parse(date).getDay();
      const freq = i < 3 ? 0.42 : 0.2;
      if (wd !== 0 && Math.random() < freq) db.sessions.push({ id: uid(), clientId: c.id, date, time: times[(i + rnd(0, 2)) % times.length], kind, note: '', createdAt: Date.now() + d, unitPrice: singlePrice(kind) });
    }
  });
  const a = made[0]; a.schedule = { slots: { 1: '16:00', 3: '15:00', 4: '15:00' }, kind: 'szemelyi' };
  scheduleDates(getSched(a), addDays(t, 1), 8, a.id).dates.forEach(({ date, time }) => db.sessions.push({ id: uid(), clientId: a.id, date, time, kind: 'szemelyi', note: '', planned: true, unitPrice: singlePrice('szemelyi'), createdAt: Date.now() }));
  save(); render(true); toast('Bemutató adatok betöltve');
}
async function wipeAll() {
  if (!await confirmDialog({ title: 'Minden adat törlése?', text: 'Kliensek, alkalmak, bérletek – minden. Csak akkor, ha van friss mentésed!', ok: 'Mindent törlök', danger: true })) return;
  const keepTheme = db.settings.theme;
  db = emptyDb(); db.settings.theme = keepTheme; save(false);
  while ($$('.sheet-wrap:not(.closing)').length) closeSheet();
  setTimeout(() => { render(true); toast('Minden adat törölve'); }, 200);
}

function openClient(id) { openPage(() => pageClient(id)); }

/* ---------------- Events ---------------- */
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn && tabBtn.classList.contains('tab')) { setTab(tabBtn.dataset.tab); return; }
  const go = e.target.closest('[data-tab-go]');
  if (go) { setTab(go.dataset.tabGo); return; }
  const a = e.target.closest('[data-action]'); if (!a) return;
  const d = a.dataset;
  switch (d.action) {
    case 'quick-add': haptic(); quickAdd({ date: d.date || (state.tab === 'calendar' && !pages.length ? state.selDate : today()), clientIds: d.client ? [d.client] : [] }); break;
    case 'close-sheet': closeSheet(); break;
    case 'close-page': closePage(); break;
    case 'settings': settingsSheet(); break;
    case 'new-client': clientForm(null, { name: d.name || '' }); break;
    case 'edit-client': clientForm(d.id); break;
    case 'open-client': openClient(d.id); break;
    case 'open-session': sessionSheet(d.id); break;
    case 'new-pass': passForm(d.id); break;
    case 'edit-pass': { const p = db.passes.find(x => x.id === d.id); if (p) passForm(p.clientId, p.id); break; }
    case 'mark-days': markDays(d.id); break;
    case 'schedule': scheduleSheet(d.id); break;
    case 'open-bill': billSheet(d.id, d.month || state.billMonth); break;
    case 'pick-day': {
      const date = d.date;
      if (mkey(date) !== state.calMonth) { const dir = date > state.calMonth ? 1 : -1; state.calMonth = mkey(date); state.selDate = date; render(false, dir); }
      else if (state.selDate === date) quickAdd({ date });
      else { state.selDate = date; haptic(); render(false); }
      break;
    }
    case 'cal-prev': calShift(-1); break;
    case 'cal-next': calShift(1); break;
    case 'cal-today': state.calMonth = mkey(today()); state.selDate = today(); render(false); break;
    case 'bill-prev': state.billMonth = shiftMonth(state.billMonth, -1); render(false); break;
    case 'bill-next': state.billMonth = shiftMonth(state.billMonth, 1); render(false); break;
    case 'backup': exportBackup(); break;
    case 'import': startImport(); break;
    case 'undo-import': {
      const prev = localStorage.getItem(PREV_KEY); if (!prev) break;
      confirmDialog({ title: 'Visszaállítás előtti állapot?', text: 'A visszaállítás előtti adatok kerülnek vissza.', ok: 'Visszaállítom' }).then(ok => {
        if (!ok) return; db = migrate(JSON.parse(prev)); localStorage.removeItem(PREV_KEY); save(); closeSheet(); setTimeout(() => { render(true); toast('Kész'); }, 200);
      });
      break;
    }
    case 'prices': pricesSheet(); break;
    case 'check-update': checkUpdate(true); break;
    case 'demo': closeSheet(); setTimeout(loadDemo, 150); break;
    case 'wipe': wipeAll(); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'client-q') { state.q = e.target.value; $('#client-list').innerHTML = clientListHtml(); }
});
// visszatéréskor (pl. éjfél után) frissítjük a "ma"-t
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

/* ---------------- Service worker ---------------- */
let swReg = null, swWaiting = null, updateToastShown = false;
function showUpdate(w) {
  swWaiting = w;
  if (updateToastShown) return;
  updateToastShown = true;
  toast('Új verzió érhető el', { action: 'Frissítés', duration: 10 * 60 * 1000, onAction: () => applyUpdate() });
  refresh(); // beállításokban is jelezzük
}
function applyUpdate() { if (swWaiting) swWaiting.postMessage('skipWaiting'); else location.reload(); }
async function checkUpdate(manual) {
  if (!swReg) { if (manual) toast('A frissítés-keresés itt nem érhető el'); return; }
  try { await swReg.update(); } catch (e) {}
  if (swReg.waiting && navigator.serviceWorker.controller) { if (manual) applyUpdate(); else showUpdate(swReg.waiting); }
  else if (manual) setTimeout(() => { if (swReg.waiting) applyUpdate(); else if (!swReg.installing) toast(`Ez a legfrissebb verzió (v${APP_VERSION})`); else toast('Új verzió töltődik…'); }, 1500);
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
      });
      reg.update().catch(() => {});
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  });
  // iPhone-on a háttérből visszahozott app nem tölt újra – ilyenkor is keresünk frissítést
  document.addEventListener('visibilitychange', () => { if (!document.hidden && swReg) checkUpdate(false); });
  setInterval(() => { if (swReg && !document.hidden) checkUpdate(false); }, 30 * 60 * 1000);
}

/* ---------------- Start ---------------- */
applyTheme();
render(true);

})();
