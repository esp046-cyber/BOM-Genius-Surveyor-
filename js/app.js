'use strict';
/* BOM-Genius Surveyor - offline SCADA site survey, BOM/services estimator, risk analyzer. Vanilla ES6, no dependencies. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const n = v => Number(v) || 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (t, a = {}, ...c) => {
  const e = document.createElement(t);
  for (const k in a) {
    const v = a[k];
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  c.flat().forEach(x => e.append(x && x.nodeType ? x : document.createTextNode(x == null || x === false ? '' : x)));
  return e;
};
const toast = (m, ms = 2400) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); };
const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
const today = () => new Date().toISOString().slice(0, 10);
const dl = (blob, name) => { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };

/* ===================== CONFIG ===================== */
const PROTOS = ['OPC UA', 'OPC DA', 'Modbus TCP', 'Modbus RTU (RS-485)', 'Profinet', 'EtherNet/IP', 'BACnet', 'IEC 61850'];
const TIERS = [500, 1000, 2500, 5000, 10000, 25000, 60000];
const TIER_PRICE = { 500: 18000, 1000: 30000, 2500: 52000, 5000: 85000, 10000: 140000, 25000: 230000, 60000: 380000 };
const CATS = ['Software & Licensing', 'Server, Workstation & Network Hardware', 'Engineering, PM & QA Services', 'Manual Items'];
const SECTIONS = [
  { t: 'Project & Client', f: [['name', 'Project Name', 'text'], ['client', 'Client Name', 'text'], ['location', 'Site Location (Dubai / UAE)', 'text'], ['date', 'Survey Date', 'date'], ['engineer', 'SCADA Engineer', 'text'], ['ref', 'Estimation Ref. No.', 'text']] },
  { t: 'Field & PLC Integration Audit', f: [['plcCount', 'PLCs / RTUs (qty)', 'number'], ['plcBrands', 'Brands / models (Allen-Bradley, Siemens, Schneider...)', 'text'], ['protocols', 'Communication protocols required', 'multi'], ['di', 'Digital Inputs', 'number'], ['do', 'Digital Outputs', 'number'], ['ai', 'Analog Inputs', 'number'], ['ao', 'Analog Outputs', 'number'], ['softTags', 'Soft / protocol / calculated / internal tags', 'number']] },
  { t: 'Network & Physical Site Conditions', f: [['distance', 'Control room distance (m)', 'number'], ['panelSpace', 'Control panel free space', 'select', ['Adequate', 'Limited', 'None - new enclosure needed']], ['ambient', 'Ambient temperature / cooling', 'select', ['Air-conditioned (<35C)', 'Ventilated (35-45C)', 'Hot, no cooling (>45C UAE summer)']], ['power', 'Power & UPS availability', 'select', ['UPS available', 'Mains only - UPS needed', 'Unstable supply - UPS + conditioning']]] },
  { t: 'SCADA Architecture & Redundancy', f: [['arch', 'Architecture type', 'select', [['intouch', 'Standalone Wonderware InTouch HMI'], ['sysplat', 'Distributed AVEVA System Platform (Application Server)']]], ['redApp', 'Redundant App / IO servers', 'check'], ['redHist', 'Redundant Historian', 'check'], ['ring', 'Ring network topology', 'check']] },
  { t: 'Client Stations', f: [['opWs', 'Operator workstations', 'number'], ['engWs', 'Engineering stations', 'number'], ['rds', 'Remote RDS / Web thin clients', 'number'], ['tpc', 'Industrial touch panel PCs', 'number']] },
  { t: 'HMI Scope', f: [['scrLow', 'Graphic screens - Low complexity', 'number'], ['scrMed', 'Graphic screens - Medium', 'number'], ['scrHigh', 'Graphic screens - High', 'number'], ['alarmScreens', 'Alarm & trend screens', 'number'], ['scripting', 'Custom .NET / QuickScript level', 'select', ['None', 'Low', 'Medium', 'High']]] },
  { t: 'Database & Reporting', f: [['historian', 'Wonderware Historian + SQL Server', 'check'], ['sqlQ', 'Custom SQL queries / stored procedures', 'number'], ['reports', 'Automated shift / daily / compliance reports', 'number']] }
];

const ASSUMP = [
  'Existing PLC source code is unlocked, documented and available to us.',
  'Existing Modbus / OPC register maps and tag lists are supplied by the client before design starts.',
  'Civil trenching, cable trays and 230 VAC / UPS power feeds are by the client.',
  'Shutdown / cutover windows are provided by client operations as agreed.',
  'Client IT provides domain, IP addressing, firewall rules and Windows licensing support.',
  'Third-party vendor interfaces are ready for integration testing on the agreed dates.',
  'Site access, permits-to-work and QHSE induction are arranged by the client (Annexure-SCT-HR-001).',
  'Excludes PLC programming, field instruments and electrical panel works unless stated.',
  'Hardware and licence prices are indicative and subject to vendor confirmation at order.',
  'Offer validity 30 days; delivery lead times per vendor confirmation.'
];
const R = (cat, title, l, i, mit) => ({ id: uid() + Math.random().toString(36).slice(2, 5), cat, title, l, i, mit });
const defaultRisks = () => [
  R('Technical', 'Legacy PLC protocol incompatibility', 3, 4, 'Obtain PLC model/firmware list at survey; bench-test driver; budget gateway.'),
  R('Technical', 'Undocumented Modbus register maps', 4, 3, 'Request register maps in writing; allocate reverse-engineering hours; client sign-off on tag list.'),
  R('Technical', 'OPC DCOM security bottlenecks', 3, 3, 'Prefer OPC UA; pre-agree domain/firewall rules with client IT.'),
  R('Technical', 'SQL database sizing bottleneck', 2, 4, 'Size Historian retention and storage at design stage; plan archiving.'),
  R('Technical', 'Network latency / fiber routing obstacles', 3, 3, 'Walk cable route; confirm tray/duct capacity and fiber termination points.'),
  R('Commercial', 'Long-lead delivery on industrial hardware', 4, 3, 'Place early orders for switches/IPCs; confirm stock with distributor; state lead times in offer.'),
  R('Commercial', 'Brownfield shutdown window constraints', 3, 5, 'Agree shutdown calendar; stage cutover; prepare rollback plan.'),
  R('Commercial', 'Third-party vendor interface delays', 3, 3, 'Define interface responsibility matrix and dates in contract.'),
  R('QHSE', 'Live panel electrical hazards (LOTO required)', 2, 5, 'LOTO per Annexure-SCT-HR-001; qualified personnel only; permit before panel entry.'),
  R('QHSE', 'High ambient temperature / heat stress in UAE plant rooms', 4, 3, 'Schedule work in cooler hours; hydration and rest breaks; heat-stress monitoring.'),
  R('QHSE', 'Working at heights for cable pulling', 2, 4, 'Approved access equipment, harness, trained personnel, permit-to-work.'),
  R('QHSE', 'Hazardous area (ATEX) classification', 2, 5, 'Confirm area classification drawings; use certified equipment; hot-work permit controls.'),
  R('QHSE', 'PPE & permit-to-work (PTW) compliance', 3, 4, 'Site induction, PPE checks, PTW issued daily and audited.')
];

const DEF_SET = () => ({ company: 'Al Gurg Automation and Controls', location: 'Dubai, U.A.E.', engineer: '', refPrefix: 'AGAC-EST-', buffer: 20, mgHw: 12, mgSv: 25, vatLabel: 'UAE VAT', vat: 5, fx: 3.6725, prices: {} });
const loadSet = () => { try { return Object.assign(DEF_SET(), JSON.parse(localStorage.getItem('bg_settings') || '{}')); } catch (e) { return DEF_SET(); } };
let SET = loadSet();
const saveSet = () => { try { localStorage.setItem('bg_settings', JSON.stringify(SET)); } catch (e) { toast('Could not save settings'); } };
const newSurvey = () => ({
  id: uid(), name: '', client: '', location: SET.location, date: today(), engineer: SET.engineer, ref: SET.refPrefix ? SET.refPrefix + new Date().toISOString().slice(2, 10).replace(/-/g, '') : '',
  plcCount: 2, plcBrands: '', protocols: [], di: 0, do: 0, ai: 0, ao: 0, softTags: 0,
  distance: 50, panelSpace: 'Adequate', ambient: 'Air-conditioned (<35C)', power: 'UPS available',
  arch: 'intouch', redApp: false, redHist: false, ring: false,
  opWs: 1, engWs: 1, rds: 0, tpc: 0, scrLow: 5, scrMed: 5, scrHigh: 0, alarmScreens: 2, scripting: 'Low',
  historian: true, sqlQ: 0, reports: 0,
  mgHw: SET.mgHw, mgSv: SET.mgSv, vat: SET.vat, assump: ASSUMP.map(() => true), assumpNote: '', photos: [], contMode: 'auto', contManual: 5, cur: 'AED', fx: SET.fx,
  extras: [], prices: {}, qtys: {}, risks: defaultRisks(), opps: [], updated: Date.now()
});
const sampleSurvey = () => Object.assign(newSurvey(), {
  name: 'Jebel Ali Water Pumping Station SCADA Upgrade', client: 'Dubai Utility Client (sample)', location: 'Jebel Ali, Dubai, U.A.E.',
  engineer: 'SCADA Engineer', ref: 'AGAC-EST-0001', plcCount: 6, plcBrands: 'Allen-Bradley CompactLogix, Siemens S7-1200',
  protocols: ['OPC UA', 'Modbus TCP', 'Modbus RTU (RS-485)', 'EtherNet/IP'], di: 320, do: 160, ai: 140, ao: 24, softTags: 900,
  distance: 140, panelSpace: 'Limited', ambient: 'Ventilated (35-45C)', power: 'Mains only - UPS needed',
  arch: 'sysplat', redApp: true, redHist: false, ring: true, opWs: 2, engWs: 1, rds: 3, tpc: 2,
  scrLow: 8, scrMed: 12, scrHigh: 3, alarmScreens: 4, scripting: 'Medium', historian: true, sqlQ: 6, reports: 5,
  opps: [{ id: uid(), title: 'Legacy SCADA migration to AVEVA System Platform', value: 180000, note: 'Existing InTouch 10 nodes at neighbouring station' }, { id: uid(), title: 'Annual Maintenance Contract (AMC)', value: 60000, note: 'Yearly support and patching' }, { id: uid(), title: 'Mobile web HMI clients', value: 45000, note: 'Management dashboard access' }]
});

const presetSkid = () => Object.assign(newSurvey(), { name: 'Standalone InTouch skid (preset)', plcCount: 1, protocols: ['Modbus TCP'], di: 32, do: 16, ai: 16, ao: 4, softTags: 100, distance: 20, arch: 'intouch', opWs: 1, engWs: 0, tpc: 1, scrLow: 4, scrMed: 2, alarmScreens: 1, scripting: 'None', historian: false });
const presetPlant = () => Object.assign(newSurvey(), { name: 'Redundant System Platform plant (preset)', plcCount: 12, plcBrands: 'Siemens S7-1500, Allen-Bradley ControlLogix', protocols: ['OPC UA', 'Modbus TCP', 'Profinet', 'EtherNet/IP'], di: 900, do: 500, ai: 450, ao: 80, softTags: 4000, distance: 180, power: 'Unstable supply - UPS + conditioning', arch: 'sysplat', redApp: true, redHist: true, ring: true, opWs: 4, engWs: 2, rds: 6, tpc: 4, scrLow: 15, scrMed: 25, scrHigh: 8, alarmScreens: 8, scripting: 'High', historian: true, sqlQ: 15, reports: 12 });
const presetSubstation = () => Object.assign(newSurvey(), { name: 'Dubai utility substation (preset)', plcCount: 8, plcBrands: 'Schneider, Siemens', protocols: ['IEC 61850', 'Modbus TCP', 'Modbus RTU (RS-485)', 'OPC UA'], di: 600, do: 240, ai: 180, ao: 20, softTags: 1500, distance: 120, ambient: 'Hot, no cooling (>45C UAE summer)', arch: 'sysplat', redApp: true, ring: true, opWs: 2, engWs: 1, rds: 2, tpc: 2, scrLow: 10, scrMed: 15, scrHigh: 4, alarmScreens: 6, scripting: 'Medium', historian: true, sqlQ: 8, reports: 6 });
const SECS = [
  s => (s.name || 'Unnamed') + ' | ' + (s.client || 'no client'),
  s => n(s.plcCount) + ' PLCs | ' + s.protocols.length + ' protocols | ' + tagInfo(s).total.toLocaleString() + ' tags',
  s => n(s.distance) + ' m | ' + (n(s.distance) > 90 ? 'Fiber' : 'Cat6A'),
  s => (s.arch === 'sysplat' ? 'System Platform' : 'InTouch') + (s.redApp || s.redHist ? ' | Redundant' : '') + (s.ring ? ' | Ring' : ''),
  s => (n(s.opWs) + n(s.engWs) + n(s.rds) + n(s.tpc)) + ' stations',
  s => (n(s.scrLow) + n(s.scrMed) + n(s.scrHigh)) + ' screens | ' + n(s.alarmScreens) + ' alarm/trend',
  s => (s.historian ? 'Historian' : 'No historian') + ' | ' + n(s.sqlQ) + ' queries | ' + n(s.reports) + ' reports'
];
const openSecs = new Set([0]);
const INFO = {
  1: 'Tag sizing: hardwired I/O plus soft tags, plus the spare buffer from Settings, picks the smallest Wonderware tier that fits (500 to 60,000+). Each selected protocol adds an OI Server/driver licence and integration hours; Modbus RTU adds protocol gateways.',
  3: 'Redundancy: redundant app/IO servers double the application server, firewall and server count; a redundant historian doubles the historian licence and server. Ring topology adds one switch and design hours.',
  2: 'Distance above 90 m switches Cat6A to fiber (OS2) with SFP modules. Hot rooms add a cooling unit; no free panel space adds a new enclosure.'
};
const info = t => h('button', { type: 'button', class: 'info', title: t, 'aria-label': 'More information', onclick: e => { e.preventDefault(); e.stopPropagation(); showTip(t); } }, '\u24D8');
function showTip(t) { modal('modalTip', 'Info', h('p', { class: 'help', style: 'margin:0 0 4px' }, t)); }
let riskFilter = 'All';

/* ===================== STORAGE ===================== */
const idb = () => new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('no idb'));
  const r = indexedDB.open('bomgenius', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('surveys', { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const lsAll = () => { try { return JSON.parse(localStorage.getItem('bg_surveys') || '[]'); } catch (e) { return []; } };
const lsSet = a => { try { localStorage.setItem('bg_surveys', JSON.stringify(a)); } catch (e) { toast('Storage full or blocked'); } };
const store = {
  async all() {
    try { const d = await idb(); return await new Promise((res, rej) => { const q = d.transaction('surveys').objectStore('surveys').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
    catch (e) { return lsAll(); }
  },
  async put(o) {
    try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('surveys', 'readwrite'); t.objectStore('surveys').put(o); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
    catch (e) { const a = lsAll().filter(x => x.id !== o.id); a.push(o); lsSet(a); }
  },
  async del(id) {
    try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('surveys', 'readwrite'); t.objectStore('surveys').delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
    catch (e) { lsSet(lsAll().filter(x => x.id !== id)); }
  }
};

let S = newSurvey();
let saveTimer;
let saveTxt = 'Ready';
function setSave(t) { saveTxt = t; $('#saveState').textContent = t; const b = $('#rbSave b'); if (b) b.textContent = t; }
const markSaved = () => setSave('Saved offline \u2713 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
function updateRibbon() {
  const el = $('#ribbon'); if (!el) return;
  const t = totals(S), T = tagInfo(S), c = (l, v, x, cls) => '<div class="rb"><small>' + l + '</small><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b>' + (x ? '<em>' + x + '</em>' : '') + '</div>';
  el.innerHTML = c('Tags (+' + SET.buffer + '%)', T.buf.toLocaleString(), 'Tier ' + T.label) + c('Grand total incl. VAT', esc(money(t.total))) + c('Eng. hours', Math.round(t.hours).toLocaleString() + ' h') + c('Risk index', t.rs.lvl[0] + ' ' + t.rs.idx + '%', '', t.rs.lvl[1]) + '<div class="rb" id="rbSave"><small>Auto-save</small><b>' + esc(saveTxt) + '</b></div>';
}
function changed(light) {
  S.updated = Date.now();
  setSave('Saving...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { await store.put(JSON.parse(JSON.stringify(S))); try { localStorage.setItem('bg_current', S.id); } catch (e) { } markSaved(); }, 400);
  updateRibbon();
  if (!light) renderActive();
  else updateSurveySummary();
}

/* ===================== ENGINE ===================== */
function tagInfo(s) {
  const hard = n(s.di) + n(s.do) + n(s.ai) + n(s.ao), total = hard + n(s.softTags), buf = Math.ceil(total * (1 + n(SET.buffer) / 100));
  let tier = TIERS.find(t => t >= buf), mult = 1;
  if (!tier) { tier = 60000; mult = Math.ceil(buf / 60000); }
  return { hard, total, buf, tier, mult, label: mult > 1 ? '60,000+ (x' + mult + ')' : tier.toLocaleString() };
}
function riskStats(s) {
  const sc = s.risks.map(r => n(r.l) * n(r.i));
  const mean = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0;
  const max = sc.length ? Math.max(...sc) : 0;
  let cont = mean < 5 ? 3 : mean < 9 ? 5 : mean < 13 ? 8 : mean < 17 ? 12 : 15;
  if (max >= 20) cont += 2;
  const idx = Math.round(mean / 25 * 100);
  const lvl = idx < 20 ? ['Low', 's-low'] : idx < 40 ? ['Moderate', 's-med'] : idx < 60 ? ['High', 's-high'] : ['Critical', 's-crit'];
  return { mean, max, cont, idx, lvl, crit: sc.filter(x => x >= 15).length };
}
const scoreInfo = sc => sc >= 20 ? ['Critical', 's-crit', 'ESCALATE: management approval before proceeding.'] : sc >= 15 ? ['High', 's-high', 'Mitigate before execution; assign owner and date.'] : sc >= 8 ? ['Medium', 's-med', 'Controls in place; monitor weekly.'] : ['Low', 's-low', 'Accept; routine monitoring.'];

function deriveBOM(s, raw) {
  const out = [];
  const it = (id, cat, desc, qty, unit, price) => { if (qty > 0) out.push({ id, cat, desc, qty, unit, price }); };
  const T = tagInfo(s), sys = s.arch === 'sysplat', P = s.protocols, plc = n(s.plcCount);
  const op = n(s.opWs), eng = n(s.engWs), rds = n(s.rds), tpc = n(s.tpc);
  const clients = op + eng + rds + tpc;
  const SW = CATS[0], HW = CATS[1], SV = CATS[2];
  /* Software */
  it('sw-tier', SW, (sys ? 'AVEVA System Platform' : 'Wonderware InTouch HMI') + ' runtime, ' + T.label + ' tag tier (incl. ' + SET.buffer + '% spare)', T.mult, 'ea', raw ? TIER_PRICE[T.tier] : (SET.prices['tier-' + T.tier] ?? TIER_PRICE[T.tier]));
  it('sw-dev', SW, (sys ? 'System Platform IDE / Development Studio' : 'InTouch WindowMaker Development Studio'), eng || 1, 'ea', sys ? 14000 : 9000);
  if (sys) it('sw-app', SW, 'Application Server / Galaxy Repository license' + (s.redApp ? ' (redundant pair)' : ''), s.redApp ? 2 : 1, 'ea', 22000);
  it('sw-oi', SW, 'OI Server / OPC / Modbus driver licenses (' + (P.join(', ') || 'general') + ')', P.length || (plc > 0 ? 1 : 0), 'ea', 5500);
  if (s.historian) it('sw-hist', SW, 'AVEVA Historian server license' + (s.redHist ? ' (redundant)' : ''), s.redHist ? 2 : 1, 'ea', 38000);
  if (s.historian || sys) it('sw-sql', SW, 'Microsoft SQL Server Standard + CALs', 1, 'ea', 9500);
  it('sw-cal', SW, 'SQL / Windows Server client access licenses (CALs)', clients, 'ea', 650);
  it('sw-cli', SW, 'InTouch / Web client access licenses (operators, RDS, panels)', op + rds + tpc, 'ea', 4200);
  /* Hardware */
  const srv = (sys ? 2 : 1) * (s.redApp || s.redHist ? 2 : 1);
  it('hw-srv', HW, 'Rack server / industrial PC (SCADA / Historian / App)', srv, 'ea', 24000);
  it('hw-rack', HW, '19" server rack / enclosure with PDU', srv > 0 ? 1 : 0, 'ea', 6500);
  it('hw-op', HW, 'Operator workstation PC', op, 'ea', 7500);
  it('hw-eng', HW, 'Engineering station PC', eng, 'ea', 9500);
  it('hw-mon', HW, 'Industrial monitor (dual-monitor set, 24")', op + eng, 'set', 1700);
  it('hw-tpc', HW, 'Industrial touch panel PC', tpc, 'ea', 13500);
  const nodes = plc + srv + op + eng + tpc + 2;
  const swSize = nodes <= 8 ? 8 : nodes <= 16 ? 16 : 24;
  const swQty = Math.max(1, Math.ceil(nodes / swSize)) + (s.ring ? 1 : 0);
  const fiber = n(s.distance) > 90;
  it('hw-sw', HW, 'Managed industrial Ethernet switch, ' + swSize + '-port' + (fiber ? ' with SFP fiber ports' : ''), swQty, 'ea', swSize === 8 ? 2800 : swSize === 16 ? 4800 : 7600);
  if (fiber) { it('hw-sfp', HW, 'SFP fiber transceiver module (LC, OS2)', swQty * 2, 'ea', 650); it('hw-cab', HW, 'Fiber optic cable OS2 incl. 20% slack, termination & testing', Math.ceil(n(s.distance) * 1.2), 'm', 14); }
  else it('hw-cat6', HW, 'Cat6A cabling incl. 20% slack and testing', Math.ceil(n(s.distance) * 1.2) + plc * 10, 'm', 6);
  it('hw-patch', HW, 'Patch panel, patch cords & cable management', 1, 'lot', 1500);
  if (P.includes('Modbus RTU (RS-485)')) it('hw-gw', HW, 'Protocol gateway (Modbus RTU to Modbus TCP / OPC)', Math.max(1, Math.ceil(plc / 4)), 'ea', 2600);
  it('hw-fw', HW, 'Industrial firewall / cybersecurity appliance' + (s.redApp ? ' (HA pair)' : ''), s.redApp ? 2 : 1, 'ea', 7500);
  const gear = srv + op + eng;
  it('hw-ups', HW, 'Rack / line-interactive UPS (' + s.power + ')', (gear > 6 ? 2 : 1) + (s.power.startsWith('Mains') || s.power.startsWith('Unstable') ? 0 : 0), 'ea', s.power.startsWith('Unstable') ? 8500 : 5200);
  if (s.ambient.startsWith('Hot')) it('hw-cool', HW, 'Panel / room cooling unit for high-ambient UAE conditions', 1, 'ea', 6000);
  if (s.panelSpace.startsWith('None')) it('hw-encl', HW, 'New control enclosure (IP54) with mounting', 1, 'ea', 5500);
  /* Services (hours) */
  const protoN = P.length, hm = n(s.scrLow) * 4 + n(s.scrMed) * 8 + n(s.scrHigh) * 16 + n(s.alarmScreens) * 6;
  const hDesign = 24 + 4 * plc + 2 * protoN + (sys ? 24 : 0) + (s.redApp || s.redHist ? 16 : 0) + (s.ring ? 6 : 0);
  const hScript = { None: 0, Low: 8, Medium: 24, High: 56 }[s.scripting] + Math.ceil(T.total / 500) * 2;
  const hSql = (s.historian ? 16 : 0) + n(s.sqlQ) * 6 + n(s.reports) * 10;
  const hInteg = plc * 10 + protoN * 8 + Math.ceil(T.total / 200) + 12;
  const hFat = 16 + Math.ceil(hm * 0.15), hSat = 24 + Math.ceil(hm * 0.2) + plc * 2, hTrain = 8 + 4 * (op + eng);
  const hSub = hDesign + hm + hScript + hSql + hInteg + hFat + hSat + hTrain;
  const hPm = Math.ceil(hSub * 0.12) + 8;
  const hQ = Math.ceil(hSub * 0.04) + 6;
  it('sv-des', SV, 'System design, FDS/DDS documentation & architecture specs', hDesign, 'hr', 380);
  it('sv-hmi', SV, 'HMI graphics, alarms & trends development (' + (n(s.scrLow) + n(s.scrMed) + n(s.scrHigh)) + ' screens + ' + n(s.alarmScreens) + ' alarm/trend)', hm, 'hr', 340);
  it('sv-scr', SV, 'Custom scripting, data acquisition & debugging (' + s.scripting + ')', hScript, 'hr', 360);
  it('sv-sql', SV, 'SQL database integration, queries & reports', hSql, 'hr', 360);
  it('sv-int', SV, 'OPC / Modbus / PLC integration & network configuration', hInteg, 'hr', 360);
  it('sv-fat', SV, 'Factory acceptance test (FAT)', hFat, 'hr', 340);
  it('sv-sat', SV, 'Site acceptance test (SAT) & commissioning', hSat, 'hr', 380);
  it('sv-trn', SV, 'End-user training', hTrain, 'hr', 320);
  it('sv-pm', SV, 'Project management, procurement oversight & scheduling', hPm, 'hr', 420);
  it('sv-qhse', SV, 'QHSE & legal documentation, permits (Annexure-SCT-HR-001)', hQ, 'hr', 340);
  /* apply overrides + extras */
  const res = out.map(x => ({ ...x, qty: s.qtys[x.id] ?? x.qty, price: s.prices[x.id] ?? (raw ? x.price : (SET.prices[x.id] ?? x.price)), auto: true }));
  s.extras.forEach(e => res.push({ ...e, auto: false }));
  return res.map(x => ({ ...x, tot: n(x.qty) * n(x.price) }));
}
function totals(s) {
  const items = deriveBOM(s), rs = riskStats(s);
  const by = {}; CATS.forEach(c => by[c] = 0);
  items.forEach(i => { by[i.cat] = (by[i.cat] || 0) + i.tot; });
  const sub = Object.values(by).reduce((a, b) => a + b, 0);
  const cp = s.contMode === 'auto' ? rs.cont : n(s.contManual);
  const cont = sub * cp / 100, svc = by[CATS[2]] || 0;
  const mgHwAmt = (sub - svc) * (1 + cp / 100) * n(s.mgHw) / 100, mgSvAmt = svc * (1 + cp / 100) * n(s.mgSv) / 100, mg = mgHwAmt + mgSvAmt;
  const net = sub + cont + mg, vat = net * n(s.vat) / 100;
  const hours = items.filter(i => i.unit === 'hr').reduce((a, i) => a + n(i.qty), 0);
  return { items, by, sub, cp, cont, mg, mgHwAmt, mgSvAmt, net, vat, total: net + vat, hours, rs };
}
const money = (v, s = S) => s.cur === 'USD' ? 'USD ' + (v / n(s.fx || 3.6725)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'AED ' + Math.round(v).toLocaleString();

/* ===================== SURVEY TAB ===================== */
function field(f) {
  const [k, label, type, opts] = f;
  if (type === 'check') return h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!S[k], onchange: e => { S[k] = e.target.checked; changed(true); } }), label);
  if (type === 'multi') return h('div', { style: 'grid-column:1/-1' }, h('label', {}, label), h('div', { class: 'chips' }, PROTOS.map(p => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.protocols.includes(p), onchange: e => { S.protocols = e.target.checked ? [...S.protocols, p] : S.protocols.filter(x => x !== p); changed(true); } }), p))));
  let inp;
  if (type === 'select') {
    inp = h('select', { onchange: e => { S[k] = e.target.value; changed(true); } }, opts.map(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return h('option', { value: v, selected: S[k] === v }, t); }));
  } else if (type === 'number') {
    const box = h('input', { type: 'number', value: S[k] ?? 0, min: 0, inputmode: 'numeric', oninput: e => { S[k] = n(e.target.value); changed(true); } });
    const set = v => { v = Math.max(0, v); box.value = v; S[k] = v; changed(true); };
    const PILL = ['di', 'do', 'ai', 'ao', 'softTags', 'scrLow', 'scrMed', 'scrHigh', 'alarmScreens', 'sqlQ', 'reports'];
    return h('div', {}, h('label', {}, label), h('div', { class: 'step' }, h('button', { type: 'button', class: 'sb', 'aria-label': 'decrease', onclick: () => set(n(box.value) - 1) }, '\u2212'), box, h('button', { type: 'button', class: 'sb', 'aria-label': 'increase', onclick: () => set(n(box.value) + 1) }, '+')),
      PILL.includes(k) ? h('div', { class: 'pills' }, [5, 10, 50].map(d => h('button', { type: 'button', class: 'pill-b', onclick: () => set(n(box.value) + d) }, '+' + d))) : '');
  } else {
    inp = h('input', { type, value: S[k] ?? '', oninput: e => { S[k] = e.target.value; changed(true); } });
  }
  return h('div', {}, h('label', {}, label), inp);
}
function renderSurvey() {
  const p = $('#tab-survey'); p.replaceChildren();
  p.append(h('div', { class: 'card', id: 'sumCard' }));
  const PRE = [['Standalone InTouch skid', presetSkid], ['Redundant System Platform plant', presetPlant], ['Dubai utility substation', presetSubstation], ['Sample survey', sampleSurvey]];
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Quick-start presets'), h('div', { class: 'row' }, PRE.map(x => h('button', { class: 'btn ghost sm', onclick: () => { if (confirm('Replace the current survey with this preset? (it is saved as a new survey)')) loadSurvey(x[1](), 'Preset loaded'); } }, x[0])),
    h('span', { style: 'flex:1' }), h('button', { class: 'btn sm', onclick: () => $$('details.sec').forEach(d => d.open = true) }, 'Expand all'), h('button', { class: 'btn sm ghost', onclick: () => $$('details.sec').forEach(d => d.open = false) }, 'Collapse all'))));
  SECTIONS.forEach((sec, si) => p.append(h('details', { class: 'card sec', open: openSecs.has(si), ontoggle: e => { e.target.open ? openSecs.add(si) : openSecs.delete(si); } },
    h('summary', {}, h('span', { class: 'st' }, sec.t, INFO[si] ? info(INFO[si]) : ''), h('span', { class: 'sp', id: 'sp' + si })), h('div', { class: 'grid', style: 'margin-top:10px' }, sec.f.map(field)))));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Proposed architecture (auto-drawn from survey inputs)'), h('div', { id: 'archBox', class: 'tw' })));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Technical assumptions & exclusions (printed in report)'),
    ASSUMP.map((a, i) => h('label', { class: 'chk', style: 'align-items:flex-start;padding:6px 0' }, h('input', { type: 'checkbox', checked: S.assump[i] !== false, onchange: e => { S.assump[i] = e.target.checked; changed(true); } }), a)),
    h('label', { style: 'margin-top:8px' }, 'Additional assumptions / exclusions'), h('textarea', { rows: 3, oninput: e => { S.assumpNote = e.target.value; changed(true); } }, S.assumpNote || '')));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Site photos & nameplates (stored offline)'),
    h('label', { class: 'btn alt', style: 'display:inline-flex;align-items:center;cursor:pointer;margin:0' }, 'Take / add photos', h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true, onchange: e => { addPhotos([...e.target.files]); e.target.value = ''; } })),
    h('div', { class: 'grid', style: 'margin-top:10px' }, (S.photos || []).map(ph => h('div', {}, h('img', { src: ph.data, alt: ph.caption || 'site photo', style: 'width:100%;border-radius:8px;border:1px solid var(--line)' }),
      h('input', { value: ph.caption, placeholder: 'Caption (panel, PLC part no., switch ports...)', oninput: e => { ph.caption = e.target.value; changed(true); } }),
      h('button', { class: 'btn bad sm', style: 'margin-top:4px', onclick: () => { S.photos = S.photos.filter(x => x.id !== ph.id); changed(); } }, 'Remove'))))));
  updateSurveySummary();
}
function updateSurveySummary() {
  const ab = $('#archBox'); if (ab) ab.innerHTML = archSVG(S);
  SECS.forEach((f, i) => { const e = $('#sp' + i); if (e) e.textContent = f(S); });
  const c = $('#sumCard'); if (!c) return;
  const T = tagInfo(S), t = totals(S);
  c.replaceChildren(h('h2', {}, 'Live sizing summary'), h('div', { class: 'kpis', style: 'margin:0' },
    kpi('Hardwired I/O', T.hard.toLocaleString()), kpi('Total tags', T.total.toLocaleString()), kpi('With ' + SET.buffer + '% buffer', T.buf.toLocaleString()), kpi('Licence tier', T.label, 1),
    kpi('Fiber / Cat6A', n(S.distance) > 90 ? 'Fiber (>90 m)' : 'Cat6A'), kpi('Risk index', t.rs.idx + '% ' + t.rs.lvl[0]), kpi('Estimate incl. VAT', money(t.total), 1)));
}
const kpi = (l, v, hl) => h('div', { class: 'kpi' + (hl ? ' hl' : '') }, h('small', {}, l), h('b', {}, v));

/* ===================== BOM TAB ===================== */
function renderBOM() {
  const p = $('#tab-bom'); p.replaceChildren();
  const t = totals(S);
  p.append(h('div', { class: 'kpis' }, kpi('Subtotal', money(t.sub)), kpi('Contingency ' + t.cp + '%', money(t.cont)), kpi('Margin (HW/SW ' + n(S.mgHw) + '% | Svc ' + n(S.mgSv) + '%)', money(t.mg)), kpi(SET.vatLabel + ' ' + n(S.vat) + '%', money(t.vat)), kpi('Grand total incl. VAT', money(t.total), 1), kpi('Services hours', Math.round(t.hours).toLocaleString() + ' h')));
  const segs = [['Software licensing', t.by[CATS[0]], '#38d6ff'], ['Server / network hardware & manual items', t.by[CATS[1]] + t.by[CATS[3]], '#7c9cff'], ['Engineering services', t.by[CATS[2]], '#2ecc71'], ['Risk contingency', t.cont, '#f1c40f'], ['Margin', t.mg, '#ff8a1f'], [SET.vatLabel + ' ' + n(S.vat) + '%', t.vat, '#ff4d4d']];
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Cost distribution (share of grand total)'), h('div', { class: 'cbar' }, segs.map(g => h('div', { style: 'width:' + (t.total ? g[1] / t.total * 100 : 0) + '%;background:' + g[2], title: g[0] }))),
    h('div', { class: 'legend' }, segs.map(g => h('span', {}, h('i', { style: 'background:' + g[2] }), g[0] + ' ' + (t.total ? (g[1] / t.total * 100).toFixed(1) : '0') + '% (' + money(g[1]) + ')')))));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Commercial controls'), h('div', { class: 'grid' },
    h('div', {}, h('label', {}, 'Currency'), h('select', { onchange: e => { S.cur = e.target.value; changed(); } }, ['AED', 'USD'].map(c => h('option', { selected: S.cur === c }, c)))),
    h('div', {}, h('label', {}, 'AED per 1 USD'), h('input', { type: 'number', step: '0.0001', value: S.fx, onchange: e => { S.fx = n(e.target.value) || 3.6725; changed(); } })),
    h('div', {}, h('label', {}, 'Hardware / software margin %'), h('input', { type: 'number', value: S.mgHw, onchange: e => { S.mgHw = n(e.target.value); changed(); } })),
    h('div', {}, h('label', {}, 'Engineering services margin %'), h('input', { type: 'number', value: S.mgSv, onchange: e => { S.mgSv = n(e.target.value); changed(); } })),
    h('div', {}, h('label', {}, SET.vatLabel + ' %'), h('input', { type: 'number', value: S.vat, onchange: e => { S.vat = n(e.target.value); changed(); } })),
    h('div', {}, h('label', {}, 'Contingency mode'), h('select', { onchange: e => { S.contMode = e.target.value; changed(); } }, [['auto', 'Auto from risk index (' + t.rs.cont + '%)'], ['manual', 'Manual %']].map(o => h('option', { value: o[0], selected: S.contMode === o[0] }, o[1])))),
    S.contMode === 'manual' ? h('div', {}, h('label', {}, 'Manual contingency %'), h('input', { type: 'number', value: S.contManual, onchange: e => { S.contManual = n(e.target.value); changed(); } })) : ''),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn ghost sm', onclick: () => { S.qtys = {}; S.prices = {}; changed(); toast('Overrides reset to auto values'); } }, 'Reset all overrides'), h('span', { class: 'small mut' }, 'Unit prices are editable placeholders. Confirm against current vendor price lists.'))));
  CATS.forEach(cat => {
    const rows = t.items.filter(i => i.cat === cat); if (!rows.length) return;
    const tb = h('table', {}, h('thead', {}, h('tr', {}, ['Description', 'Qty', 'Unit', 'Unit price (AED)', 'Line total', ''].map((x, i) => h('th', { class: i > 0 && i !== 2 ? 'n' : '' }, x)))),
      h('tbody', {}, rows.map(r => h('tr', {},
        h('td', { class: 'd' }, r.auto ? r.desc : h('input', { value: r.desc, onchange: e => { S.extras.find(x => x.id === r.id).desc = e.target.value; changed(true); } })),
        h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: r.qty, onchange: e => setQty(r, e.target.value) })),
        h('td', {}, r.unit),
        h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: r.price, onchange: e => setPrice(r, e.target.value) })),
        h('td', { class: 'n' }, money(r.tot)),
        h('td', {}, r.auto ? (S.qtys[r.id] != null || S.prices[r.id] != null ? h('button', { class: 'btn ghost sm', title: 'Reset', onclick: () => { delete S.qtys[r.id]; delete S.prices[r.id]; changed(); } }, 'Auto') : '') : h('button', { class: 'btn bad sm', onclick: () => { S.extras = S.extras.filter(x => x.id !== r.id); changed(); } }, 'Del'))))),
      h('tfoot', {}, h('tr', { class: 'sub' }, h('td', { colspan: 4 }, cat + ' subtotal'), h('td', { class: 'n' }, money(t.by[cat])), h('td'))));
    p.append(h('div', { class: 'card' }, h('h3', {}, cat), h('div', { class: 'tw' }, tb)));
  });
  /* manual add */
  const f = { cat: CATS[3], desc: '', qty: 1, unit: 'ea', price: 0 };
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Add manual line item'), h('div', { class: 'grid' },
    h('div', {}, h('label', {}, 'Category'), h('select', { onchange: e => f.cat = e.target.value }, CATS.map(c => h('option', { selected: c === f.cat }, c)))),
    h('div', {}, h('label', {}, 'Description'), h('input', { oninput: e => f.desc = e.target.value })),
    h('div', {}, h('label', {}, 'Qty'), h('input', { type: 'number', value: 1, oninput: e => f.qty = n(e.target.value) })),
    h('div', {}, h('label', {}, 'Unit'), h('input', { value: 'ea', oninput: e => f.unit = e.target.value })),
    h('div', {}, h('label', {}, 'Unit price (AED)'), h('input', { type: 'number', oninput: e => f.price = n(e.target.value) }))),
    h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => { if (!f.desc.trim()) return toast('Enter a description'); S.extras.push({ id: uid(), cat: f.cat, desc: f.desc, qty: f.qty, unit: f.unit || 'ea', price: f.price }); changed(); } }, 'Add line')));
}
function setQty(r, v) { if (r.auto) S.qtys[r.id] = n(v); else S.extras.find(x => x.id === r.id).qty = n(v); changed(); }
function setPrice(r, v) { if (r.auto) S.prices[r.id] = n(v); else S.extras.find(x => x.id === r.id).price = n(v); changed(); }

/* ===================== RISK TAB ===================== */
function renderRisk() {
  const p = $('#tab-risk'); p.replaceChildren();
  const rs = riskStats(S);
  p.append(h('div', { class: 'kpis' }, kpi('Project risk index', rs.idx + '%'), h('div', { class: 'kpi' }, h('small', {}, 'Level'), h('b', { class: rs.lvl[1] }, rs.lvl[0])), kpi('Recommended contingency', rs.cont + '%', 1), kpi('Risks scored 15+', String(rs.crit)), kpi('Highest score', String(rs.max))));
  const hcls = sc => sc >= 20 ? 'hm-r' : sc >= 12 ? 'hm-o' : sc >= 6 ? 'hm-y' : 'hm-g';
  const vis = S.risks.filter(r => riskFilter === 'All' || r.cat === riskFilter);
  p.append(h('div', { class: 'card' }, h('h2', {}, '5x5 likelihood vs impact heatmap'),
    h('div', { class: 'row', style: 'margin-bottom:10px' }, ['All', 'Technical', 'Commercial', 'QHSE'].map(f => h('button', { class: 'btn sm ' + (riskFilter === f ? '' : 'ghost'), onclick: () => { riskFilter = f; renderRisk(); } }, f + ' (' + S.risks.filter(r => f === 'All' || r.cat === f).length + ')'))),
    h('div', { class: 'hm' }, [5, 4, 3, 2, 1].flatMap(l => [h('div', { class: 'hl' }, 'L' + l), ...[1, 2, 3, 4, 5].map(i => { const c = vis.filter(r => n(r.l) === l && n(r.i) === i).length; return h('div', { class: 'hc ' + hcls(l * i), title: 'L' + l + ' x I' + i + ' = ' + l * i }, c ? String(c) : ''); })]), h('div'), ...[1, 2, 3, 4, 5].map(i => h('div', { class: 'hl' }, 'I' + i))),
    h('div', { class: 'small mut', style: 'margin-top:6px' }, 'Rows: Likelihood 5 to 1. Columns: Impact 1 to 5. Number = risks in that cell (' + riskFilter + ').')));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Risk register (Likelihood 1-5 x Impact 1-5), QHSE per Annexure-SCT-HR-001', info('Score = Likelihood x Impact. QHSE risks follow Annexure-SCT-HR-001: LOTO, heat stress, work at height, ATEX areas, PPE and permit-to-work. The average score sets the recommended contingency: under 5 = 3%, under 9 = 5%, under 13 = 8%, under 17 = 12%, otherwise 15%, plus 2% if any single risk scores 20 or more.')),
    h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Category', 'Risk', 'L', 'I', 'Score', 'Mitigation / action', ''].map(x => h('th', {}, x)))),
      h('tbody', {}, vis.map(r => {
        const sc = n(r.l) * n(r.i), inf = scoreInfo(sc);
        const sel = k => h('select', { style: 'width:64px', onchange: e => { r[k] = n(e.target.value); changed(); } }, [1, 2, 3, 4, 5].map(v => h('option', { selected: n(r[k]) === v }, v)));
        return h('tr', {}, h('td', {}, h('select', { onchange: e => { r.cat = e.target.value; changed(); } }, ['Technical', 'Commercial', 'QHSE'].map(c => h('option', { selected: r.cat === c }, c)))),
          h('td', { class: 'd' }, h('input', { value: r.title, onchange: e => { r.title = e.target.value; changed(); } })),
          h('td', {}, sel('l')), h('td', {}, sel('i')),
          h('td', {}, h('span', { class: 'badge ' + inf[1] }, sc + ' ' + inf[0])),
          h('td', { class: 'd' }, h('input', { value: r.mit, onchange: e => { r.mit = e.target.value; changed(); } }), h('div', { class: 'small mut' }, 'Auto: ' + inf[2])),
          h('td', {}, h('button', { class: 'btn bad sm', onclick: () => { S.risks = S.risks.filter(x => x.id !== r.id); changed(); } }, 'Del')));
      })))),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn', onclick: () => { S.risks.push(R('Technical', 'New risk', 3, 3, '')); changed(); } }, 'Add risk'),
      h('button', { class: 'btn ghost', onclick: () => { S.risks = defaultRisks(); changed(); } }, 'Restore default register'))));
  /* opportunities */
  const o = { title: '', value: 0, note: '' };
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Opportunities log (commercial upsell)'),
    S.opps.length ? h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ['Opportunity', 'Est. value (AED)', 'Notes', ''].map(x => h('th', {}, x)))), h('tbody', {}, S.opps.map(x => h('tr', {}, h('td', { class: 'd' }, h('input', { value: x.title, onchange: e => { x.title = e.target.value; changed(true); } })), h('td', {}, h('input', { type: 'number', value: x.value, onchange: e => { x.value = n(e.target.value); changed(true); } })), h('td', { class: 'd' }, h('input', { value: x.note, onchange: e => { x.note = e.target.value; changed(true); } })), h('td', {}, h('button', { class: 'btn bad sm', onclick: () => { S.opps = S.opps.filter(y => y.id !== x.id); changed(); } }, 'Del'))))))) : h('p', { class: 'mut' }, 'No opportunities captured yet.'),
    h('div', { class: 'grid', style: 'margin-top:10px' },
      h('div', {}, h('label', {}, 'Opportunity'), h('input', { id: 'oTitle', placeholder: 'e.g. SQL Energy Management dashboard', oninput: e => o.title = e.target.value })),
      h('div', {}, h('label', {}, 'Est. value (AED)'), h('input', { id: 'oVal', type: 'number', oninput: e => o.value = n(e.target.value) })),
      h('div', {}, h('label', {}, 'Notes'), h('input', { oninput: e => o.note = e.target.value }))),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => { if (!o.title.trim()) return toast('Enter an opportunity'); S.opps.push({ id: uid(), ...o }); changed(); } }, 'Add opportunity'),
      ...['Legacy SCADA migration to System Platform', 'SQL Energy Management dashboard', 'Mobile Web HMI clients', 'Annual Maintenance Contract (AMC)'].map(t => h('button', { class: 'btn ghost sm', onclick: () => { S.opps.push({ id: uid(), title: t, value: 0, note: '' }); changed(); } }, '+ ' + t)))));
}

/* ===================== VAULT / EXPORT ===================== */
async function renderVault() {
  const p = $('#tab-vault'); p.replaceChildren();
  const list = (await store.all()).sort((a, b) => b.updated - a.updated);
  await refreshStorage(false);
  const lb = +localStorage.getItem('bg_backup') || 0, stale = !lb || Date.now() - lb > 7 * 864e5;
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Data safety'),
    h('p', { style: 'margin:0 0 6px' }, 'Last JSON backup: ', h('b', { class: stale ? 's-high' : 's-low' }, lb ? new Date(lb).toLocaleString() : 'Never'), stale ? '  \u2014 back up now with "Backup ALL surveys".' : ''),
    storageRow()));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Offline project vault'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => loadSurvey(newSurvey(), 'New survey started') }, 'New survey'),
      h('button', { class: 'btn alt', onclick: () => loadSurvey(sampleSurvey(), 'Sample Dubai water station survey loaded') }, 'Load sample Dubai survey'),
      h('button', { class: 'btn ghost', onclick: async () => { await store.put(JSON.parse(JSON.stringify(S))); markSaved(); toast('Saved'); renderVault(); } }, 'Save now')),
    h('div', { class: 'vlist', style: 'margin-top:10px' }, list.length ? list.map(x => h('div', { class: 'item' + (x.id === S.id ? ' cur' : '') },
      h('div', {}, h('b', {}, x.name || '(unnamed survey)'), h('div', { class: 'small mut' }, (x.client || 'no client') + ' · ' + (x.location || '') + ' · edited ' + new Date(x.updated).toLocaleString())),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => loadSurvey(x, 'Loaded') }, 'Load'),
        h('button', { class: 'btn ghost sm', onclick: async () => { const c = JSON.parse(JSON.stringify(x)); c.id = uid(); c.name = (c.name || 'Survey') + ' (copy)'; c.updated = Date.now(); await store.put(c); toast('Duplicated'); renderVault(); } }, 'Duplicate'),
        h('button', { class: 'btn bad sm', onclick: async () => { if (!confirm('Delete this survey permanently?')) return; await store.del(x.id); if (x.id === S.id) S = newSurvey(); toast('Deleted'); renderVault(); } }, 'Delete')))) : h('p', { class: 'mut' }, 'Vault is empty.'))));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Export & report'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: exportCSV }, 'Export BOM & services (CSV)'),
      h('button', { class: 'btn', onclick: () => dl(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), fname() + '.json') }, 'Export project JSON'),
      h('button', { class: 'btn', onclick: exportAll }, 'Backup ALL surveys (JSON)'),
      h('label', { class: 'btn ghost', style: 'display:inline-flex;align-items:center;margin:0;cursor:pointer;color:var(--tx);font-size:.95rem' }, 'Import project JSON', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: importJSON })),
      h('button', { class: 'btn alt', onclick: printReport }, 'Generate printable PDF report')),
    h('p', { class: 'small mut' }, 'The report opens your browser print dialog: choose "Save as PDF". All exports run locally on this device.')));
}
function loadSurvey(o, msg) {
  const keep = msg === 'Loaded';
  S = Object.assign(newSurvey(), JSON.parse(JSON.stringify(o)));
  if (!keep) S.id = uid();
  changed(true); renderSurvey(); toast(msg); switchTab('survey');
}
const fname = () => 'BOM-Genius_' + (S.ref || S.name || 'survey').replace(/[^\w-]+/g, '_');
const csvc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
function exportCSV() {
  const t = totals(S);
  const rows = [['Project', S.name], ['Client', S.client], ['Location', S.location], ['Ref', S.ref], ['Engineer', S.engineer], ['Survey date', S.date], [], ['Category', 'Description', 'Qty', 'Unit', 'Unit price AED', 'Line total AED']];
  t.items.forEach(i => rows.push([i.cat, i.desc, i.qty, i.unit, i.price, i.tot]));
  rows.push([], ['', 'Subtotal', '', '', '', t.sub], ['', 'Contingency ' + t.cp + '%', '', '', '', Math.round(t.cont)], ['', 'Margin hardware/software ' + n(S.mgHw) + '%', '', '', '', Math.round(t.mgHwAmt)], ['', 'Margin services ' + n(S.mgSv) + '%', '', '', '', Math.round(t.mgSvAmt)], ['', 'Total before VAT', '', '', '', Math.round(t.net)], ['', SET.vatLabel + ' ' + n(S.vat) + '%', '', '', '', Math.round(t.vat)], ['', 'GRAND TOTAL AED incl. VAT', '', '', '', Math.round(t.total)], ['', 'GRAND TOTAL USD incl. VAT @ ' + S.fx, '', '', '', Math.round(t.total / n(S.fx))]);
  dl(new Blob(['﻿' + rows.map(r => r.map(csvc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fname() + '_BOM.csv');
}
async function exportAll() {
  const all = await store.all(); const cur = JSON.parse(JSON.stringify(S)); const list = all.filter(x => x.id !== cur.id); list.push(cur);
  dl(new Blob([JSON.stringify({ app: 'bom-genius', version: 1, exported: new Date().toISOString(), surveys: list }, null, 2)], { type: 'application/json' }), 'BOM-Genius_backup_' + today() + '.json');
  try { localStorage.setItem('bg_backup', String(Date.now())); } catch (e) { }
  toast('Backup of ' + list.length + ' survey(s) exported'); renderVault();
}
function importJSON(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const o = JSON.parse(r.result);
      if (o && Array.isArray(o.surveys)) { for (const x of o.surveys) { x.id = uid(); await store.put(Object.assign(newSurvey(), x)); } toast(o.surveys.length + ' survey(s) imported'); renderVault(); return; }
      if (!o || !Array.isArray(o.risks)) throw 0;
      o.id = uid(); S = Object.assign(newSurvey(), o); changed(true); renderSurvey(); renderVault(); toast('Project imported');
    } catch (x) { toast('Invalid project file'); }
  };
  r.readAsText(f); e.target.value = '';
}
function printReport() {
  const t = totals(S), T = tagInfo(S);
  const m = v => money(v);
  const kv = (a, b) => '<tr><th style="width:34%">' + esc(a) + '</th><td>' + esc(b) + '</td></tr>';
  let html = '<div class="ph"><div><h1>' + esc(SET.company) + '</h1><div>' + esc(SET.location) + ' | SCADA Site Survey, Estimate &amp; Risk Report</div></div><div style="text-align:right">Ref: ' + esc(S.ref || '-') + '<br>Date: ' + esc(S.date) + '</div></div>' +
    '<div class="exec"><div><b>' + esc(S.name || 'Untitled project') + '</b><br>Client: ' + esc(S.client || '-') + '<br>Site: ' + esc(S.location) + '<br>Engineer: ' + esc(S.engineer || '-') + '</div><div>Grand total incl. VAT: <b>' + m(t.total) + '</b><br>Engineering hours: <b>' + Math.round(t.hours) + ' h</b><br>Tag tier: <b>' + T.label + '</b> (' + T.total + ' tags)<br>Risk index: <b>' + t.rs.idx + '% ' + t.rs.lvl[0] + '</b></div></div>';
  html += '<h2>1. Project &amp; survey audit</h2><table>' + kv('Project', S.name) + kv('Client', S.client) + kv('Site', S.location) + kv('Engineer', S.engineer) +
    kv('PLCs / RTUs', S.plcCount + (S.plcBrands ? ' (' + S.plcBrands + ')' : '')) + kv('Protocols', S.protocols.join(', ') || '-') +
    kv('I/O (DI/DO/AI/AO)', [S.di, S.do, S.ai, S.ao].join(' / ') + '; soft tags ' + S.softTags) + kv('Tag sizing', T.total + ' tags, ' + T.buf + ' with ' + SET.buffer + '% buffer, tier ' + T.label) +
    kv('Network / site', 'Distance ' + S.distance + ' m (' + (S.distance > 90 ? 'fiber' : 'Cat6A') + '); panel space: ' + S.panelSpace + '; ' + S.ambient + '; ' + S.power) +
    kv('Architecture', (S.arch === 'sysplat' ? 'AVEVA System Platform' : 'Wonderware InTouch') + '; redundant app: ' + (S.redApp ? 'yes' : 'no') + '; redundant historian: ' + (S.redHist ? 'yes' : 'no') + '; ring: ' + (S.ring ? 'yes' : 'no')) +
    kv('Clients', 'Operator ' + S.opWs + ', engineering ' + S.engWs + ', RDS/web ' + S.rds + ', touch PCs ' + S.tpc) +
    kv('HMI scope', 'Screens L/M/H ' + S.scrLow + '/' + S.scrMed + '/' + S.scrHigh + '; alarm/trend ' + S.alarmScreens + '; scripting ' + S.scripting) +
    kv('Database', (S.historian ? 'Historian + SQL' : 'No historian') + '; queries ' + S.sqlQ + '; reports ' + S.reports) + '</table>';
  html += '<h2>1a. Proposed SCADA architecture</h2>' + archSVG(S);
  html += '<h2 class="pb">2. Bill of materials</h2>';
  CATS.forEach(c => {
    const rows = t.items.filter(i => i.cat === c && i.unit !== 'hr'); if (!rows.length) return;
    html += '<table><colgroup><col style="width:44%"><col style="width:8%"><col style="width:8%"><col style="width:20%"><col style="width:20%"></colgroup><thead><tr><th colspan="5">' + esc(c) + '</th></tr><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total</th></tr></thead><tbody>' + rows.map(i => '<tr><td>' + esc(i.desc) + '</td><td>' + i.qty + '</td><td>' + esc(i.unit) + '</td><td>' + m(i.price) + '</td><td>' + m(i.tot) + '</td></tr>').join('') + '</tbody></table>';
  });
  const sv = t.items.filter(i => i.unit === 'hr');
  html += '<h2>3. Engineering services &amp; man-hours</h2><table><colgroup><col style="width:52%"><col style="width:12%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>Service</th><th>Hours</th><th>Rate/hr</th><th>Total</th></tr></thead><tbody>' + sv.map(i => '<tr><td>' + esc(i.desc) + '</td><td>' + i.qty + '</td><td>' + m(i.price) + '</td><td>' + m(i.tot) + '</td></tr>').join('') + '<tr><th>Total hours</th><th>' + Math.round(t.hours) + '</th><th></th><th></th></tr></tbody></table>';
  html += '<h2>4. Commercial summary</h2><table>' + kv('Subtotal', m(t.sub)) + kv('Contingency ' + t.cp + '% (' + S.contMode + ')', m(t.cont)) + kv('Margin - hardware / software ' + n(S.mgHw) + '%', m(t.mgHwAmt)) + kv('Margin - services ' + n(S.mgSv) + '%', m(t.mgSvAmt)) + kv('Total before VAT', m(t.net)) + kv(SET.vatLabel + ' ' + n(S.vat) + '%', m(t.vat)) + '<tr><th>GRAND TOTAL incl. VAT</th><th>' + m(t.total) + '</th></tr></table><p style="font-size:8.5pt">Indicative estimate. Unit prices are placeholders pending vendor confirmation.</p>';
  html += assumpHTML();
  html += '<h2 class="pb">5. Risk matrix &amp; QHSE (Annexure-SCT-HR-001)</h2><p>Project risk index: <b>' + t.rs.idx + '% (' + t.rs.lvl[0] + ')</b>. Recommended contingency: <b>' + t.rs.cont + '%</b>.</p><table><colgroup><col style="width:11%"><col style="width:28%"><col style="width:5%"><col style="width:5%"><col style="width:13%"><col style="width:38%"></colgroup><thead><tr><th>Cat.</th><th>Risk</th><th>L</th><th>I</th><th>Score</th><th>Mitigation</th></tr></thead><tbody>' +
    [...S.risks].sort((a, b) => b.l * b.i - a.l * a.i).map(r => '<tr><td>' + esc(r.cat) + '</td><td>' + esc(r.title) + '</td><td>' + r.l + '</td><td>' + r.i + '</td><td>' + (r.l * r.i) + ' ' + scoreInfo(r.l * r.i)[0] + '</td><td>' + esc(r.mit) + '</td></tr>').join('') + '</tbody></table>';
  html += '<h2>6. Opportunities</h2>' + (S.opps.length ? '<table><colgroup><col style="width:42%"><col style="width:20%"><col style="width:38%"></colgroup><thead><tr><th>Opportunity</th><th>Est. value</th><th>Notes</th></tr></thead><tbody>' + S.opps.map(o => '<tr><td>' + esc(o.title) + '</td><td>' + m(n(o.value)) + '</td><td>' + esc(o.note) + '</td></tr>').join('') + '</tbody></table>' : '<p>None recorded.</p>');
  html += photosHTML();
  html += '<div class="sig"><div>Prepared by (SCADA Engineer)<br>Name / Date</div><div>Reviewed by (Estimation)<br>Name / Date</div><div>Client acknowledgement<br>Name / Date</div></div>';
  $('#printArea').innerHTML = html;
  setTimeout(() => window.print(), 100);
}

/* ===================== ARCHITECTURE / ASSUMPTIONS / PHOTOS ===================== */
const wrapTxt = (t, m) => { const w = String(t).split(' '), L = []; let c = ''; w.forEach(x => { if ((c + ' ' + x).trim().length > m && c) { L.push(c); c = x; } else c = (c + ' ' + x).trim(); }); if (c) L.push(c); return L.slice(0, 3); };
function archSVG(s) {
  const sys = s.arch === 'sysplat', T = tagInfo(s), items = deriveBOM(s), q = id => (items.find(i => i.id === id) || {}).qty;
  const cl = [['Operator WS', s.opWs], ['Engineering WS', s.engWs], ['RDS / Web clients', s.rds], ['Touch panel PCs', s.tpc]].filter(x => n(x[1]) > 0).map(x => x[0] + ' x' + n(x[1]));
  const rows = [
    ['L3 Clients', cl.length ? cl : ['No client stations']],
    ['L3 SCADA servers', [(sys ? 'AVEVA System Platform App/IO Server' : 'InTouch SCADA / IO Server') + (s.redApp ? ' x2 redundant' : ''), ...(s.historian ? ['AVEVA Historian + SQL' + (s.redHist ? ' x2 redundant' : '')] : [])]],
    ['L3.5 Network / DMZ', ['Industrial firewall' + (s.redApp ? ' (HA pair)' : ''), 'Managed switches x' + (q('hw-sw') || 1) + (s.ring ? ' (ring)' : '') + (n(s.distance) > 90 ? ', fiber ' + n(s.distance) + ' m' : ', Cat6A')]],
    ['L2 Control network', ['Protocols: ' + (s.protocols.join(', ') || 'to be confirmed'), ...(q('hw-gw') ? ['Protocol gateways x' + q('hw-gw')] : [])]],
    ['L1 Field', [n(s.plcCount) + ' PLC / RTU' + (s.plcBrands ? ' (' + s.plcBrands + ')' : ''), 'I/O ' + T.hard + ' hardwired, ' + T.total + ' tags (tier ' + T.label + ')']]
  ];
  const W = 900, X0 = 150, AW = 735, BH = 58, GAP = 42, H = 20 + rows.length * (BH + GAP);
  let g = '', prev = null;
  rows.forEach((r, ri) => {
    const y = 10 + ri * (BH + GAP), k = r[1].length, bw = Math.min(210, (AW - (k - 1) * 14) / k), tot = k * bw + (k - 1) * 14, x0 = X0 + (AW - tot) / 2;
    g += '<text x="6" y="' + (y + BH / 2 + 4) + '" font-size="11" font-weight="700" fill="#b85a00">' + esc(r[0]) + '</text>';
    const cx = [];
    r[1].forEach((t, i) => {
      const x = x0 + i * (bw + 14); cx.push(x + bw / 2);
      g += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + BH + '" rx="8" fill="#eef4f9" stroke="#0b1d2e" stroke-width="1.5"/>';
      wrapTxt(t, Math.floor(bw / 6.6)).forEach((l, li, a) => { g += '<text x="' + (x + bw / 2) + '" y="' + (y + BH / 2 + 4 + (li - (a.length - 1) / 2) * 13) + '" text-anchor="middle" font-size="11" fill="#0b1d2e">' + esc(l) + '</text>'; });
    });
    if (prev) {
      const my = y - GAP / 2, all = [...prev.cx, ...cx];
      g += '<g stroke="#38708f" stroke-width="2" fill="none">' + prev.cx.map(c => '<line x1="' + c + '" y1="' + (prev.y + BH) + '" x2="' + c + '" y2="' + my + '"/>').join('') + cx.map(c => '<line x1="' + c + '" y1="' + my + '" x2="' + c + '" y2="' + y + '"/>').join('') + '<line x1="' + Math.min(...all) + '" y1="' + my + '" x2="' + Math.max(...all) + '" y2="' + my + '"/></g>';
    }
    prev = { y, cx };
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:900px;height:auto;background:#fff;border-radius:8px" font-family="Arial,Helvetica,sans-serif" role="img" aria-label="SCADA architecture diagram">' + g + '</svg>';
}
function assumpHTML() {
  const on = ASSUMP.filter((a, i) => S.assump[i] !== false);
  return '<h2>Technical assumptions &amp; exclusions</h2><ul style="margin:4px 0 0 18px;padding:0;font-size:9.5pt">' + on.map(a => '<li>' + esc(a) + '</li>').join('') + (S.assumpNote ? '<li>' + esc(S.assumpNote) + '</li>' : '') + '</ul>';
}
function photosHTML() {
  return (S.photos || []).length ? '<h2 class="pb">Site photos</h2><div class="pg">' + S.photos.map(x => '<figure><img src="' + x.data + '" alt=""><figcaption>' + esc(x.caption) + '</figcaption></figure>').join('') + '</div>' : '';
}
const compressImg = f => new Promise((res, rej) => {
  const img = new Image(), u = URL.createObjectURL(f);
  img.onload = () => { const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .7)); };
  img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad image')); }; img.src = u;
});
function markupPhoto(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = h('canvas', { width: img.width, height: img.height, class: 'mk' }), x = c.getContext('2d');
      let strokes = [], cur = null, tool = 'pen', color = '#ff2d2d';
      const draw = st => {
        x.strokeStyle = st.color; x.lineWidth = Math.max(4, img.width / 120); x.lineCap = x.lineJoin = 'round'; x.beginPath();
        if (st.tool === 'pen') { st.pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); return; }
        const a = st.pts[0], b = st.pts[st.pts.length - 1];
        if (st.tool === 'circle') { x.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, Math.PI * 2); x.stroke(); return; }
        x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = img.width / 16; x.beginPath();
        x.moveTo(b[0], b[1]); x.lineTo(b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)); x.moveTo(b[0], b[1]); x.lineTo(b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)); x.stroke();
      };
      const redraw = () => { x.drawImage(img, 0, 0); strokes.forEach(draw); if (cur) draw(cur); };
      const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); cur = { tool, color, pts: [pt(e)] }; });
      c.addEventListener('pointermove', e => { if (!cur) return; cur.pts.push(pt(e)); redraw(); });
      const end = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      const close = v => { m.remove(); resolve(v); };
      const tb = (t, f, cls) => h('button', { type: 'button', class: 'btn sm ' + (cls || 'ghost'), onclick: f }, t);
      const m = h('div', { class: 'modal' }, h('div', { class: 'mbox' }, h('h3', {}, 'Mark up photo (draw with finger or mouse)'), c,
        h('div', { class: 'row', style: 'margin-top:8px' }, tb('Pen', () => tool = 'pen'), tb('Circle', () => tool = 'circle'), tb('Arrow', () => tool = 'arrow'), tb('Red', () => color = '#ff2d2d'), tb('Yellow', () => color = '#ffd400'), tb('Undo', () => { strokes.pop(); redraw(); }), tb('Clear', () => { strokes = []; redraw(); })),
        h('div', { class: 'row', style: 'margin-top:8px' }, tb('Save photo', () => close(c.toDataURL('image/jpeg', .75)), 'alt'), tb('Save without markup', () => close(src)), tb('Discard', () => close(null), 'bad'))));
      document.body.append(m); redraw();
    };
    img.onerror = () => resolve(src); img.src = src;
  });
}
async function addPhotos(files) {
  S.photos = S.photos || [];
  let added = 0;
  for (const f of files) { try { const d = await markupPhoto(await compressImg(f)); if (d) { S.photos.push({ id: uid(), caption: '', data: d }); added++; } } catch (e) { toast('Could not read a photo'); } }
  changed(); if (added) toast(added + ' photo(s) saved offline');
}

/* ===================== STORAGE HARDENING ===================== */
let STOR = { persisted: false, usage: 0, quota: 0 };
async function refreshStorage(req) {
  const o = { persisted: false, usage: 0, quota: 0 };
  try {
    const st = navigator.storage;
    if (st && st.persisted) o.persisted = await st.persisted();
    if (req && !o.persisted && st && st.persist) o.persisted = await st.persist();
    if (st && st.estimate) { const e = await st.estimate(); o.usage = e.usage || 0; o.quota = e.quota || 0; }
  } catch (e) { }
  STOR = o; const b = $('#storState');
  if (b) { b.textContent = o.persisted ? 'Storage Locked \u2713' : 'Standard Storage'; b.className = 'pill' + (o.persisted ? ' ok' : ''); b.title = fmtBytes(o.usage) + ' used of ' + fmtBytes(o.quota); }
  return o;
}
function storageRow() {
  return h('div', { class: 'row' }, h('span', { class: 'pill' + (STOR.persisted ? ' ok' : '') }, STOR.persisted ? 'Storage Locked \u2713' : 'Standard Storage'),
    h('span', { class: 'small mut' }, 'Using ' + fmtBytes(STOR.usage) + (STOR.quota ? ' of ' + fmtBytes(STOR.quota) : '')),
    h('button', { class: 'btn ghost sm', onclick: async () => { const o = await refreshStorage(true); toast(o.persisted ? 'Persistent storage granted' : 'Browser declined; installing to Home Screen often helps'); renderActive(); $('#modalSet') && openSettings(); } }, 'Request persistent storage'));
}

/* ===================== SETTINGS ===================== */
let priceRows = null;
function priceBook() {
  if (priceRows) return priceRows;
  const full = Object.assign(newSurvey(), { plcCount: 2, protocols: PROTOS.slice(), di: 10, arch: 'sysplat', redApp: true, redHist: true, ring: true, opWs: 1, engWs: 1, rds: 1, tpc: 1, scrLow: 1, scrMed: 1, scrHigh: 1, alarmScreens: 1, scripting: 'Low', historian: true, sqlQ: 1, reports: 1, distance: 100, ambient: 'Hot, no cooling (>45C UAE summer)', panelSpace: 'None - new enclosure needed', power: 'UPS available' });
  const near = Object.assign({}, full, { distance: 50 });
  const rows = {}; [...deriveBOM(full, true), ...deriveBOM(near, true)].forEach(i => { if (i.id !== 'sw-tier' && !rows[i.id]) rows[i.id] = { id: i.id, cat: i.cat, desc: i.desc.replace(/\s*\(.*$/, ''), unit: i.unit, price: i.price }; });
  priceRows = [...TIERS.map(t => ({ id: 'tier-' + t, cat: CATS[0], desc: 'Runtime licence tier ' + t.toLocaleString() + ' tags', unit: 'ea', price: TIER_PRICE[t] })), ...Object.values(rows)];
  return priceRows;
}
function modal(id, title, body) {
  $('#' + id)?.remove();
  const m = h('div', { class: 'modal', id }, h('div', { class: 'mbox wide' }, h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, h('h2', { style: 'margin:0;color:var(--acc)' }, title), h('button', { class: 'btn sm', onclick: () => m.remove() }, 'Close')), body));
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.append(m); return m;
}
function applyBranding() {
  const b = $('.brand small'); if (b) b.textContent = SET.company + ' \u00b7 ' + SET.location;
  const f = $('.foot'); if (f) f.textContent = 'BOM-Genius Surveyor \u00b7 ' + SET.company + ' \u00b7 100% offline \u00b7 unit prices are editable placeholders, not quotations.';
}
function openSettings() {
  const sf = (k, label, type = 'text', step) => h('div', {}, h('label', {}, label), h('input', { type, value: SET[k], step: step || null, oninput: e => { SET[k] = type === 'number' ? n(e.target.value) : e.target.value; saveSet(); applyBranding(); } }));
  const body = h('div', {},
    h('div', { class: 'card' }, h('h3', {}, 'Branding & personalization'), h('div', { class: 'grid' }, sf('company', 'Company / organization name'), sf('location', 'Office location'), sf('engineer', 'Default SCADA engineer name'), sf('refPrefix', 'Estimation reference prefix'))),
    h('div', { class: 'card' }, h('h3', {}, 'Defaults for NEW surveys'), h('div', { class: 'grid' }, sf('buffer', 'Tag spare buffer %', 'number'), sf('mgHw', 'Hardware / software margin %', 'number'), sf('mgSv', 'Services margin %', 'number'), sf('vatLabel', 'Tax label'), sf('vat', 'Tax / VAT %', 'number'), sf('fx', 'AED per 1 USD', 'number', '0.0001')),
      h('p', { class: 'small mut' }, 'Existing surveys keep their own margins, VAT and rate. The tag buffer applies to all surveys immediately.')),
    h('div', { class: 'card' }, h('h3', {}, 'Master price book (applies to all surveys)'),
      h('p', { class: 'small mut' }, 'Edit the baseline unit price (AED) or hourly rate. Blank/default shows the factory value; per-survey overrides in the BOM tab still win.'),
      h('div', { class: 'tw', style: 'max-height:42vh' }, h('table', {}, h('thead', {}, h('tr', {}, ['Item', 'Unit', 'Price (AED)'].map(x => h('th', {}, x)))),
        h('tbody', {}, priceBook().map(r => h('tr', {}, h('td', {}, h('span', { class: 'mut small' }, r.cat.split(',')[0].split(' ')[0] + ': '), r.desc), h('td', {}, r.unit),
          h('td', {}, h('input', { type: 'number', min: 0, value: SET.prices[r.id] ?? r.price, onchange: e => { const v = n(e.target.value); if (v === r.price) delete SET.prices[r.id]; else SET.prices[r.id] = v; saveSet(); renderActive(); updateRibbon(); } }))))))),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn ghost', onclick: () => { if (confirm('Reset all prices and hourly rates to factory defaults?')) { SET.prices = {}; saveSet(); renderActive(); updateRibbon(); openSettings(); toast('Price book reset'); } } }, 'Reset price book to factory defaults'))),
    h('div', { class: 'card' }, h('h3', {}, 'Settings backup & storage'), h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => dl(new Blob([JSON.stringify(SET, null, 2)], { type: 'application/json' }), 'BOM-Genius_settings.json') }, 'Export settings JSON'),
      h('label', { class: 'btn ghost', style: 'display:inline-flex;align-items:center;margin:0;cursor:pointer;color:var(--tx);font-size:.95rem' }, 'Import settings JSON', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { SET = Object.assign(DEF_SET(), JSON.parse(r.result)); saveSet(); applyBranding(); renderActive(); updateRibbon(); openSettings(); toast('Settings imported'); } catch (x) { toast('Invalid settings file'); } }; r.readAsText(f); } })),
      h('button', { class: 'btn bad', onclick: () => { if (confirm('Reset ALL settings to factory defaults?')) { SET = DEF_SET(); saveSet(); applyBranding(); renderActive(); updateRibbon(); openSettings(); toast('Settings reset'); } } }, 'Reset all settings')),
      h('div', { style: 'margin-top:10px' }, storageRow())));
  modal('modalSet', 'Settings & master price book', body);
}

/* ===================== HELP ===================== */
function openHelp() {
  const li = a => '<ol>' + a.map(x => '<li>' + x + '</li>').join('') + '</ol>';
  const pages = {
    '5-step walkdown': li(['<b>Start:</b> on the Survey tab pick a quick-start preset or the sample survey, or just fill in the project header.', '<b>Count:</b> use the &minus; / + buttons and +5 / +10 / +50 pills for I/O, screens and stations. Tap Add photos to snap a panel, then draw circles or arrows with your finger and save.', '<b>Score:</b> on the Risk tab set Likelihood and Impact for each risk; the heatmap and recommended contingency update live.', '<b>Tune:</b> on the BOM tab override any quantity or price, set margins, add manual lines.', '<b>Export:</b> Vault tab: CSV for the estimation team, JSON backup, or Print report then Save as PDF (A4, enable background graphics).']),
    'How the BOM math works': '<ul><li><b>Tag tier:</b> hardwired I/O + soft tags + the spare buffer (' + SET.buffer + '%) picks the smallest tier from 500, 1,000, 2,500, 5,000, 10,000, 25,000 or 60,000+.</li><li><b>Licences:</b> one OI Server/driver per selected protocol; historian + SQL when ticked; client licences = operators + RDS + touch panels; CALs = all client stations.</li><li><b>Network:</b> switch size (8/16/24 ports) comes from PLCs + servers + stations + 2 uplinks; ring adds a switch.</li><li><b>Distance over 90 m:</b> Cat6A is replaced by OS2 fiber with SFP modules (copper is limited to about 100 m).</li><li><b>Hours:</b> design, HMI (4/8/16 h per low/medium/high screen + 6 h per alarm/trend screen), scripting, SQL, integration, FAT, SAT, training, then PM (12%) and QHSE documents (4%).</li><li><b>Contingency:</b> the average risk score sets it: under 5 = 3%, under 9 = 5%, under 13 = 8%, under 17 = 12%, otherwise 15% (+2% if any risk scores 20+). Switch to manual in the BOM tab if needed.</li><li><b>Price:</b> subtotal + contingency, then separate margins for hardware/software and services, then ' + esc(SET.vatLabel) + ' (' + SET.vat + '% default).</li></ul>',
    'Install & backup': '<p><b>Android (Chrome):</b> open the hosted https link, tap the menu, then Install app / Add to Home screen.</p><p><b>iPhone / iPad (Safari):</b> open the link, tap Share, then Add to Home Screen. Safari has no install pop-up.</p><p><b>Why https:</b> opening index.html from the Files app (file://) cannot run the offline service worker. Use a free static host or localhost.</p><p><b>Backups:</b> surveys live inside this browser. Clearing site data or losing the device erases them. Use <b>Backup ALL surveys (JSON)</b> in the Vault tab regularly; the Vault shows when you last did.</p><p><b>Storage lock:</b> the app asks the browser to keep its data; the header badge shows Storage Locked when granted.</p>'
  };
  const box = h('div', { class: 'help' }), tabs = h('div', { class: 'row', style: 'margin-bottom:10px' });
  const show = k => { box.innerHTML = pages[k]; $$('button', tabs).forEach(b => b.className = 'btn sm' + (b.dataset.k === k ? '' : ' ghost')); };
  Object.keys(pages).forEach(k => tabs.append(h('button', { 'data-k': k, class: 'btn sm ghost', onclick: () => show(k) }, k)));
  modal('modalHelp', 'Help & clicking guide', h('div', {}, tabs, box)); show('5-step walkdown');
}

/* ===================== PWA ASSETS ===================== */
function rr(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawIcon(c, S0, maskable) {
  const g = c.createLinearGradient(0, 0, S0, S0); g.addColorStop(0, '#0f2a43'); g.addColorStop(1, '#071522');
  c.fillStyle = g; if (maskable) c.fillRect(0, 0, S0, S0); else { rr(c, 0, 0, S0, S0, S0 * .18); c.fill(); }
  const R0 = S0 * (maskable ? .62 : .8) / 2;
  c.save(); c.translate(S0 / 2, S0 / 2);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = R0 * .14; c.strokeStyle = '#1e4a73'; c.beginPath(); c.arc(0, 0, R0, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#ff8a1f'; c.beginPath(); c.arc(0, 0, R0, Math.PI * .75, Math.PI * 1.9); c.stroke();
  c.strokeStyle = '#38d6ff'; c.lineWidth = R0 * .09; c.beginPath();
  [[-.55, .1], [-.27, -.15], [0, .05], [.27, -.38], [.55, -.2]].forEach((q, i) => i ? c.lineTo(q[0] * R0, q[1] * R0) : c.moveTo(q[0] * R0, q[1] * R0)); c.stroke();
  c.fillStyle = '#fff'; c.font = '800 ' + Math.round(R0 * .5) + 'px Arial,Helvetica,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BG', 0, R0 * .5);
  c.restore();
}
function drawShot(c, w, hh) {
  const nar = hh > w, p = w * .04;
  c.fillStyle = '#0b1d2e'; c.fillRect(0, 0, w, hh);
  c.fillStyle = '#0f2a43'; c.fillRect(0, 0, w, hh * (nar ? .08 : .11));
  c.save(); c.translate(p, hh * (nar ? .012 : .015)); const is = hh * (nar ? .055 : .08); c.scale(is, is); drawIcon(c, 1, false); c.restore();
  c.fillStyle = '#e8f1f8'; c.font = '700 ' + Math.round(w * (nar ? .045 : .022)) + 'px Arial'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText('BOM-Genius Surveyor', p + is * 1.3, hh * (nar ? .04 : .055));
  const cols = nar ? 1 : 3, rowsN = nar ? 4 : 2, top = hh * (nar ? .11 : .15), cw = (w - p * (cols + 1)) / cols, ch = (hh - top - p * (rowsN + 1)) / rowsN;
  const labels = ['Total tags 2,044', 'Licence tier 5,000', 'Risk index 34% Moderate', 'Estimate AED 1.2M', 'Services 612 h', 'Contingency 8%'];
  for (let r = 0; r < rowsN; r++) for (let k = 0; k < cols; k++) {
    const x = p + k * (cw + p), y = top + p * .5 + r * (ch + p), i = r * cols + k;
    c.fillStyle = '#12324f'; rr(c, x, y, cw, ch, 14); c.fill(); c.strokeStyle = '#1e4a73'; c.lineWidth = 2; c.stroke();
    c.fillStyle = i % 2 ? '#38d6ff' : '#ff8a1f'; c.fillRect(x + 14, y + 14, cw * .25, 6);
    c.fillStyle = '#e8f1f8'; c.font = '700 ' + Math.round(Math.min(cw, ch) * .16) + 'px Arial'; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(labels[i % labels.length], x + 14, y + 34);
    c.fillStyle = '#1e4a73'; for (let b = 0; b < 6; b++) c.fillRect(x + 14 + b * (cw - 28) / 6, y + ch - 14 - (b % 3 + 1) * ch * .12, (cw - 28) / 6 - 8, (b % 3 + 1) * ch * .12);
  }
}
const ASSETS = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map(s => ({ name: 'icon-' + s + '.png', dir: 'icons', w: s, h: s })),
  { name: 'icon-maskable-192.png', dir: 'icons', w: 192, h: 192, m: 1 }, { name: 'icon-maskable-512.png', dir: 'icons', w: 512, h: 512, m: 1 },
  { name: 'apple-touch-icon.png', dir: 'icons', w: 180, h: 180, m: 1 }, { name: 'favicon-16x16.png', dir: 'icons', w: 16, h: 16 }, { name: 'favicon-32x32.png', dir: 'icons', w: 32, h: 32 },
  { name: 'screenshot-wide.png', dir: 'screenshots', w: 1280, h: 720, shot: 1 }, { name: 'screenshot-narrow.png', dir: 'screenshots', w: 750, h: 1334, shot: 1 }
];
const mk = a => { const c = document.createElement('canvas'); c.width = a.w; c.height = a.h; const x = c.getContext('2d'); a.shot ? drawShot(x, a.w, a.h) : drawIcon(x, a.w, a.m); return c; };
const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
function injectIcons() {
  try {
    const u = mk({ w: 180, h: 180, m: 1 }).toDataURL('image/png'), f = mk({ w: 64, h: 64 }).toDataURL('image/png');
    let a = $('link[rel=apple-touch-icon]'); if (!a) { a = h('link', { rel: 'apple-touch-icon' }); document.head.append(a); } a.href = u;
    let i = $('link[rel=icon][type="image/png"]'); if (!i) { i = h('link', { rel: 'icon', type: 'image/png' }); document.head.append(i); } i.href = f;
  } catch (e) { }
}
function crc32(d) { let c, crc = -1; if (!crc32.t) { crc32.t = []; for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.t[i] = c >>> 0; } } for (let i = 0; i < d.length; i++) crc = crc32.t[(crc ^ d[i]) & 255] ^ (crc >>> 8); return (crc ^ -1) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const f of files) {
    const nb = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nb.length, true);
    parts.push(lh.buffer, nb, f.data);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    cd.push(ch.buffer, nb); off += 30 + nb.length + sz;
  }
  const cds = cd.reduce((a, b) => a + b.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cds, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, e.buffer], { type: 'application/zip' });
}
async function downloadZip() {
  const files = [];
  for (const a of ASSETS) files.push({ name: a.dir + '/' + a.name, data: new Uint8Array(await (await toBlob(mk(a))).arrayBuffer()) });
  dl(zipStore(files), 'bom-genius-pwa-assets.zip'); toast('ZIP downloaded: extract icons/ and screenshots/ next to index.html');
}
async function downloadAll() {
  toast('Downloading ' + ASSETS.length + ' files...');
  for (const a of ASSETS) { dl(await toBlob(mk(a)), a.name); await sleep(350); }
}
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('App installed'); });
$('#installBtn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; });

async function renderPWA() {
  const p = $('#tab-pwa'); p.replaceChildren();
  const sw = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  let cached = 0; try { for (const k of await caches.keys()) cached += (await (await caches.open(k)).keys()).length; } catch (e) { }
  const standalone = !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone);
  const secure = window.isSecureContext;
  const chk = (ok, t) => h('li', {}, h('span', { class: ok ? 's-low' : 's-high' }, ok ? '✔ ' : '✖ '), t);
  await refreshStorage(false);
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Storage protection'), storageRow()));
  p.append(h('div', { class: 'card' }, h('h2', {}, 'Install readiness'), h('ul', { class: 'chk-list', style: 'list-style:none;padding:0' },
    chk(secure, 'Secure context (HTTPS or localhost)' + (secure ? '' : ' - serve via localhost/HTTPS to install')),
    chk(!!sw, 'Service worker registered' + (sw ? ' (scope ' + sw.scope + ')' : '')),
    chk(cached > 0, 'Offline cache holds ' + cached + ' files'),
    chk(!!$('link[rel=manifest]'), 'Web app manifest linked'),
    chk(standalone, standalone ? 'Running as installed app' : 'Running in browser tab (not yet installed)'),
    chk(!!deferred, deferred ? 'Browser install prompt available' : 'Install prompt not available yet (use browser menu if icons exist)')),
    h('div', { class: 'row' }, h('button', { class: 'btn', hidden: !deferred, onclick: () => $('#installBtn').click() }, 'Install App'), h('button', { class: 'btn ghost', onclick: renderPWA }, 'Re-check'))));
  const prev = h('div', { class: 'row' });
  [[512, 512, 0], [192, 192, 1]].forEach(([w, hh, m]) => { const c = mk({ w, h: hh, m }); c.className = 'prev'; c.style.width = '128px'; prev.append(c); });
  const sc = mk({ w: 1280, h: 720, shot: 1 }); sc.className = 'prev'; sc.style.width = '260px'; prev.append(sc);
  p.append(h('div', { class: 'card' }, h('h2', {}, 'PWA icons & screenshots generator'), h('p', { class: 'mut' }, 'Draws every PNG named in manifest.webmanifest directly in your browser. Place them in the icons/ and screenshots/ folders beside index.html, then reload.'), prev,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: downloadZip }, 'Download all as ZIP (recommended)'), h('button', { class: 'btn ghost', onclick: downloadAll }, 'Download ' + ASSETS.length + ' PNGs individually')),
    h('p', { class: 'small mut' }, 'Files: ' + ASSETS.map(a => a.dir + '/' + a.name).join(', '))));
}

/* ===================== SHELL ===================== */
let active = 'survey';
const R_ = { survey: renderSurvey, bom: renderBOM, risk: renderRisk, vault: renderVault, pwa: renderPWA };
function renderActive() { R_[active](); }
function switchTab(t) {
  active = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.panel').forEach(x => x.hidden = x.id !== 'tab-' + t);
  renderActive(); scrollTo(0, 0);
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal').forEach(m => m.remove()); });
const themeLabel = () => { $('#themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? 'Sunlight mode' : 'Control room mode'; };
$('#themeBtn').addEventListener('click', () => { const r = document.documentElement, d = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = d; try { localStorage.setItem('bg_theme', d); } catch (e) { } themeLabel(); });
function net() { const o = navigator.onLine, e = $('#netState'); e.textContent = o ? 'Online' : 'Offline'; e.className = 'pill ' + (o ? 'ok' : 'bad'); }
window.addEventListener('online', net); window.addEventListener('offline', net);

(async function init() {
  try { const th = localStorage.getItem('bg_theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { }
  themeLabel(); net(); injectIcons(); applyBranding();
  $('#settingsBtn').addEventListener('click', openSettings); $('#helpBtn').addEventListener('click', openHelp);
  refreshStorage(true);
  let cur = null; try { cur = localStorage.getItem('bg_current'); } catch (e) { }
  const all = await store.all();
  const found = all.find(x => x.id === cur) || all.sort((a, b) => b.updated - a.updated)[0];
  S = found ? Object.assign(newSurvey(), found) : newSurvey();
  markSaved(); updateRibbon();
  const q = new URLSearchParams(location.search).get('tab');
  switchTab(R_[q] ? q : 'survey');
})();
