#!/usr/bin/env node
'use strict';
/*
  Holt die Daten für die F1 Fantasy Liga und speichert sie in Supabase (Schlüssel "f1data").
  Die App liest sie von dort. Läuft automatisch über GitHub Actions, geht aber auch lokal:

      node scripts/fetch-data.js            holen und speichern
      node scripts/fetch-data.js --dry      nur holen und prüfen, nichts speichern
      node scripts/fetch-data.js --debug    zusätzlich Beispiel-Einträge der Feeds ausgeben

  Quellen (alle öffentlich, ohne Login):
   - F1 Fantasy Feeds:   Fantasy-Punkte je Fahrer und Team und Rennen   (inoffiziell, nicht dokumentiert)
   - Jolpica (Ergast):   Rennkalender, Zieleinlauf, DNF
   - OpenF1:             Startnummern
   - formula1.com:       aktuelle Fahrerfotos der Saison (Fahrerseite)
*/

const SEASON = Number(process.env.SEASON || 2026);
const SUPA_URL = process.env.SUPABASE_URL || 'https://tbvqxbyadzolltlgsoxv.supabase.co';
const SUPA_KEY = process.env.SUPABASE_KEY || 'sb_publishable_pCsMLm-fostNAK1ZOvcAFA_57alHKxi';
const FANTASY = 'https://fantasy.formula1.com/feeds';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1 = 'https://api.openf1.org/v1';
const MAX_ROUNDS = 30;
const DRY = process.argv.includes('--dry');
const DEBUG = process.argv.includes('--debug');

/* ---------- Bekannte Fahrer und Teams (Namen wie in der App) ---------- */
const TEAMS = {
  'Mercedes': 'MER', 'Ferrari': 'FER', 'McLaren': 'MCL', 'Red Bull': 'RBR', 'Williams': 'WIL',
  'Racing Bulls': 'RB', 'Haas': 'HAA', 'Alpine': 'ALP', 'Audi': 'AUD', 'Cadillac': 'CAD', 'Aston Martin': 'AMR',
};
const KNOWN_DRIVERS = [
  ['George Russell', 'Mercedes', 'russell'], ['Kimi Antonelli', 'Mercedes', 'antonelli'],
  ['Charles Leclerc', 'Ferrari', 'leclerc'], ['Lewis Hamilton', 'Ferrari', 'hamilton'],
  ['Oscar Piastri', 'McLaren', 'piastri'], ['Lando Norris', 'McLaren', 'norris'],
  ['Max Verstappen', 'Red Bull', 'verstappen'], ['Isack Hadjar', 'Red Bull', 'hadjar'],
  ['Carlos Sainz', 'Williams', 'sainz'], ['Alexander Albon', 'Williams', 'albon'],
  ['Liam Lawson', 'Racing Bulls', 'lawson'], ['Arvid Lindblad', 'Racing Bulls', 'lindblad'],
  ['Rafael Camara', 'Haas', 'camara'], ['Oliver Bearman', 'Haas', 'bearman'],
  ['Pierre Gasly', 'Alpine', 'gasly'], ['Franco Colapinto', 'Alpine', 'colapinto'],
  ['Nico Hülkenberg', 'Audi', 'hulkenberg'], ['Gabriel Bortoleto', 'Audi', 'bortoleto'],
  ['Valtteri Bottas', 'Cadillac', 'bottas'], ['Sergio Perez', 'Cadillac', 'perez'],
  ['Fernando Alonso', 'Aston Martin', 'alonso'], ['Lance Stroll', 'Aston Martin', 'stroll'],
];

/* ---------- Hilfsfunktionen ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ascii = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = s => ascii(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const num = v => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const pick = (o, keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

function canonTeam(raw) {
  const n = norm(raw);
  if (!n) return null;
  if (/racing bulls|visa cash app|vcarb|alphatauri|toro rosso/.test(n) || n === 'rb') return 'Racing Bulls';
  if (/red bull/.test(n)) return 'Red Bull';
  if (/mercedes/.test(n)) return 'Mercedes';
  if (/ferrari/.test(n)) return 'Ferrari';
  if (/mclaren/.test(n)) return 'McLaren';
  if (/williams/.test(n)) return 'Williams';
  if (/haas/.test(n)) return 'Haas';
  if (/alpine/.test(n)) return 'Alpine';
  if (/audi|sauber|kick/.test(n)) return 'Audi';
  if (/cadillac/.test(n)) return 'Cadillac';
  if (/aston martin/.test(n)) return 'Aston Martin';
  return null;
}
function canonDriver(raw) {
  const n = ' ' + norm(raw) + ' ';
  for (const [name, team, key] of KNOWN_DRIVERS) if (n.includes(' ' + key + ' ')) return { name, team };
  return null;
}
function tidyName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').split(' ')
    .map(w => (w === w.toUpperCase() && w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w)).join(' ');
}

async function getJson(url, { optional = false } = {}) {
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': 'f1-liga-updater/1.0', accept: 'application/json' } });
  } catch (e) {
    if (optional) return null;
    throw new Error('Netzwerkfehler bei ' + url + ': ' + e.message);
  }
  if (!res.ok) {
    if (optional) return null;
    throw new Error('HTTP ' + res.status + ' bei ' + url);
  }
  try { return await res.json(); } catch { if (optional) return null; throw new Error('Keine gültige JSON-Antwort von ' + url); }
}

/* ---------- F1 Fantasy: Punkte je Runde ---------- */
function findPlayers(json) {
  const cands = [json && json.Data && json.Data.Value, json && json.Value, json && json.Data, json];
  for (const c of cands) if (Array.isArray(c) && c.length && typeof c[0] === 'object') return c;
  let found = null;
  (function walk(o, depth) {
    if (found || !o || depth > 4) return;
    if (Array.isArray(o)) {
      if (o.length >= 10 && o[0] && typeof o[0] === 'object' && !Array.isArray(o[0])) { found = o; return; }
      o.forEach(x => walk(x, depth + 1));
    } else if (typeof o === 'object') Object.values(o).forEach(x => walk(x, depth + 1));
  })(json, 0);
  return found || [];
}
const NAME_KEYS = ['FUllName', 'FullName', 'Fullname', 'DisplayName', 'PlayerName', 'Name'];
const TEAM_KEYS = ['TeamName', 'Team', 'TeamDisplayName'];
const ROUND_PTS_KEYS = ['GamedayPoints', 'GameDayPoints', 'RoundPoints', 'gamedaypoints', 'Points'];
const TOTAL_PTS_KEYS = ['OverallPpints', 'OverallPoints', 'TotalPoints', 'SeasonPoints'];

/* Liest einen Runden-Feed aus. Ergebnis: { drivers: {Name: {team, round, total}}, teams: {Name: {round, total}}, unknown: [...] } */
function parseFantasyRound(json) {
  const list = findPlayers(json);
  const res = { drivers: {}, teams: {}, unknown: [], sample: list[0] || null, count: list.length };
  for (const e of list) {
    const rawTeam = pick(e, TEAM_KEYS);
    const rawName = pick(e, NAME_KEYS) || rawTeam;
    const round = num(pick(e, ROUND_PTS_KEYS));
    const total = num(pick(e, TOTAL_PTS_KEYS));
    const code = pick(e, ['DriverTLA', 'TLA', 'ShortName', 'Abbreviation']);
    const posName = String(pick(e, ['PositionName', 'Position', 'PlayerType', 'Type']) || '').toLowerCase();
    const isConstructor = /construct|team/.test(posName);
    const drv = isConstructor ? null : canonDriver(rawName);
    if (drv) {
      const t = canonTeam(rawTeam) || drv.team;
      res.drivers[drv.name] = { team: t, round, total, code };
      continue;
    }
    const tm = canonTeam(rawName) || (isConstructor ? canonTeam(rawTeam) : null);
    if (tm) { res.teams[tm] = { round, total }; continue; }
    if (!isConstructor && rawName) {
      // unbekannter Fahrer (z. B. Ersatzfahrer): mit aufnehmen, sofern ein Team erkennbar ist
      const t = canonTeam(rawTeam);
      if (t) { const nm = tidyName(rawName); res.drivers[nm] = { team: t, round, total, code, extra: true }; continue; }
    }
    res.unknown.push(String(rawName || JSON.stringify(e).slice(0, 80)));
  }
  return res;
}

/* ---------- Jolpica: Kalender, Ergebnisse ---------- */
async function loadSchedule() {
  const j = await getJson(`${JOLPICA}/${SEASON}.json?limit=100`, { optional: true });
  const races = j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races || [];
  return races.map(r => ({
    r: Number(r.round), name: r.raceName, date: r.date,
    circuit: r.Circuit && r.Circuit.circuitName || null,
    place: r.Circuit && r.Circuit.Location && r.Circuit.Location.locality || null,
    country: r.Circuit && r.Circuit.Location && r.Circuit.Location.country || null,
  }));
}
function parseResults(json) {
  const race = json && json.MRData && json.MRData.RaceTable && json.MRData.RaceTable.Races && json.MRData.RaceTable.Races[0];
  if (!race || !Array.isArray(race.Results) || !race.Results.length) return null;
  const out = {};
  for (const x of race.Results) {
    const d = canonDriver(`${x.Driver && x.Driver.givenName} ${x.Driver && x.Driver.familyName}`);
    if (!d) continue;
    const status = String(x.status || '');
    const finished = status === 'Finished' || /^\+\d+ Laps?$/.test(status) || status === 'Lapped';
    out[d.name] = { dnf: finished ? 0 : 1, pos: finished ? num(x.position) : null };
  }
  return out;
}

/* ---------- OpenF1: Startnummern und Fotos ---------- */
async function loadOpenF1() {
  const j = await getJson(`${OPENF1}/drivers?session_key=latest`, { optional: true });
  const res = {};
  if (!Array.isArray(j)) return res;
  for (const x of j) {
    const d = canonDriver(x.full_name || `${x.first_name} ${x.last_name}`);
    if (!d) continue;
    const m = /\/([a-z]+\d\d)\.png/i.exec(x.headshot_url || '');
    res[d.name] = { num: num(x.driver_number), photo: x.headshot_url || null, code: x.name_acronym || null, f1id: m ? m[1].toLowerCase() : null };
  }
  return res;
}

/* ---------- formula1.com: aktuelle Fahrerfotos ----------
   Die Fahrerseite verlinkt je Fahrer ein Ganzkörperfoto der Saison, z. B.
   .../common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp
   Wir schneiden es per Bild-URL auf Kopf und Schultern zu. Ergebnis: Kennung (lannor01) -> URL. */
async function loadF1Photos() {
  let html = '';
  try {
    const res = await fetch('https://www.formula1.com/en/drivers', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; f1-liga-updater/1.0)', accept: 'text/html' } });
    if (res.ok) html = await res.text();
  } catch { /* optional */ }
  const out = {};
  const re = new RegExp(`/common/f1/${SEASON}/([a-z0-9]+)/([a-z]+\\d\\d)/${SEASON}\\1\\2right\\.webp`, 'g');
  for (const m of html.matchAll(re)) {
    out[m[2]] = `https://media.formula1.com/image/upload/c_fill,g_north,w_440,h_440/q_auto/${m[0].replace(/^\//, '')}`;
  }
  return out;
}
function f1IdGuess(name) {
  const p = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);
  return p.length < 2 ? null : p[0].slice(0, 3) + p.slice(1).join('').slice(0, 3) + '01';
}

/* ---------- Bisherige Daten aus Supabase ---------- */
async function loadPrev() {
  const j = await getJson(`${SUPA_URL}/rest/v1/liga_state?key=eq.f1data&select=value`, { optional: true });
  return Array.isArray(j) && j[0] && j[0].value && j[0].value.season === SEASON ? j[0].value : null;
}
async function save(value) {
  const res = await fetch(`${SUPA_URL}/rest/v1/liga_state`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'f1data', value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error('Speichern in Supabase fehlgeschlagen: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
}

/* ---------- Hauptablauf ---------- */
async function main() {
  const log = (...a) => console.log(...a);
  log(`F1-Daten ${SEASON} holen${DRY ? ' (Testlauf, es wird nichts gespeichert)' : ''}`);

  const prev = await loadPrev();
  const prevLast = prev ? prev.lastScored || 0 : 0;
  const refetchFrom = Math.max(1, prevLast - 1); // die letzten zwei Runden neu holen (Strafen ändern Punkte nachträglich)
  const prevD = {}, prevT = {};
  if (prev) { prev.drivers.forEach(d => { prevD[d.name] = d; }); prev.teams.forEach(t => { prevT[t.name] = t; }); }

  const schedule = await loadSchedule();
  log(`Kalender: ${schedule.length} Rennen`);

  const drivers = {}; // name -> {team, code, pts[], pos[], dnf[]}
  const teams = {};   // name -> {pts[]}
  const ensureD = (name, team, code) => (drivers[name] = drivers[name] || { name, team, code: code || null, pts: [], pos: [], dnf: [] });
  const ensureT = name => (teams[name] = teams[name] || { name, pts: [] });
  const unknownAll = new Set();
  let existing = 0, lastFantasy = 0, sampleShown = false;

  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const reuse = prev && r < refetchFrom;
    let parsed = null;
    if (!reuse) {
      const json = await getJson(`${FANTASY}/drivers/${r}_en.json`, { optional: true });
      await sleep(150);
      if (!json) break;
      parsed = parseFantasyRound(json);
      if (!parsed.count) break; // Feed existiert, ist aber leer: Runde liegt in der Zukunft
      if ((DEBUG || !Object.keys(parsed.drivers).length) && !sampleShown) {
        sampleShown = true;
        console.log('Beispiel-Eintrag aus dem Feed (Runde ' + r + '):', JSON.stringify(parsed.sample).slice(0, 700));
      }
      parsed.unknown.forEach(u => unknownAll.add(u));
    }
    existing = r;
    // Fahrer
    const names = reuse ? Object.keys(prevD) : Object.keys(parsed.drivers);
    for (const n of names) {
      const info = reuse ? { team: prevD[n].team, code: prevD[n].code, round: prevD[n].pts[r - 1] } : parsed.drivers[n];
      const d = ensureD(n, info.team, info.code);
      d.team = info.team || d.team;
      d.pts[r - 1] = info.round == null ? null : info.round;
    }
    // Teams
    const tnames = reuse ? Object.keys(prevT) : Object.keys(parsed.teams);
    for (const n of tnames) {
      const t = ensureT(n);
      t.pts[r - 1] = reuse ? (prevT[n].pts[r - 1] == null ? null : prevT[n].pts[r - 1]) : (parsed.teams[n].round == null ? null : parsed.teams[n].round);
    }
    if (!reuse) {
      // Fallback: Rundenpunkte aus Gesamtpunkten ableiten, falls der Feed keine Rundenpunkte liefert
      const delta = (store, n, cur) => {
        const before = store[n] && store[n]._total != null ? store[n]._total : (r === 1 ? 0 : null);
        if (cur != null && before != null) store[n].pts[r - 1] = cur - before;
      };
      if (Object.values(parsed.drivers).every(x => x.round == null)) for (const n of Object.keys(parsed.drivers)) delta(drivers, n, parsed.drivers[n].total);
      if (Object.values(parsed.teams).every(x => x.round == null)) for (const n of Object.keys(parsed.teams)) delta(teams, n, parsed.teams[n].total);
      for (const n of Object.keys(parsed.drivers)) if (parsed.drivers[n].total != null) drivers[n]._total = parsed.drivers[n].total;
      for (const n of Object.keys(parsed.teams)) if (parsed.teams[n].total != null) teams[n]._total = parsed.teams[n].total;
    }
    const anyPts = Object.values(drivers).some(d => d.pts[r - 1] != null && d.pts[r - 1] !== 0);
    if (anyPts) lastFantasy = r;
  }
  log(`Fantasy-Feed: ${existing} Runden gefunden, davon ${lastFantasy} mit Punkten`);

  // Ergebnisse (Zieleinlauf, DNF)
  let lastResult = 0;
  for (let r = 1; r <= existing; r++) {
    if (prev && r < refetchFrom) {
      for (const d of Object.values(drivers)) {
        const p = prevD[d.name];
        d.pos[r - 1] = p && p.pos ? (p.pos[r - 1] == null ? null : p.pos[r - 1]) : null;
        d.dnf[r - 1] = p && p.dnf ? (p.dnf[r - 1] == null ? null : p.dnf[r - 1]) : null;
      }
      if (prevLast >= r) lastResult = r;
      continue;
    }
    const json = await getJson(`${JOLPICA}/${SEASON}/${r}/results.json`, { optional: true });
    await sleep(300);
    const res = json && parseResults(json);
    for (const d of Object.values(drivers)) {
      const x = res && res[d.name];
      d.pos[r - 1] = x ? x.pos : null;
      d.dnf[r - 1] = x ? x.dnf : null;
    }
    if (res) lastResult = r;
  }
  log(`Rennergebnisse: ${lastResult} Rennen`);

  // Ausgewertet = Punkte UND Ergebnis vorhanden
  const lastScored = Math.min(lastFantasy, lastResult);

  // Fotos und Startnummern
  const of1 = await loadOpenF1();
  log(`OpenF1: ${Object.keys(of1).length} Fahrer mit Nummer`);
  const f1p = await loadF1Photos();
  log(`formula1.com: ${Object.keys(f1p).length} aktuelle Fahrerfotos`);

  // Team-Fahrerlisten
  // In die Teamlisten kommen nur aktuelle Fahrer: bekannte Fahrer immer, unbekannte (Ersatzfahrer, Ausgeschiedene)
  // nur, wenn sie im letzten Rennen mit Punkten dabei waren. So bleibt der Fahrerpool der Liga sauber.
  const li = (lastFantasy || existing || 1) - 1;
  const teamDrivers = {};
  Object.values(drivers).forEach(d => {
    if (!d.team) return;
    const known = KNOWN_DRIVERS.some(k => k[0] === d.name);
    const current = known || (d.pts[li] != null && d.pts[li] !== 0);
    if (current) (teamDrivers[d.team] = teamDrivers[d.team] || []).push(d.name);
  });

  const maxLen = Math.max(existing, 1);
  const fill = a => Array.from({ length: maxLen }, (_, i) => (a[i] === undefined ? null : a[i]));
  const out = {
    v: 1, season: SEASON, updated: new Date().toISOString(), lastScored,
    rounds: (schedule.length ? schedule : Array.from({ length: maxLen }, (_, i) => ({ r: i + 1, name: 'Rennen ' + (i + 1) })))
      .filter(x => x.r <= Math.max(existing, lastScored)).map(x => ({ r: x.r, name: x.name })),
    next: (() => {
      const x = schedule.find(y => y.r === lastScored + 1);
      return x ? { r: x.r, name: x.name, circuit: x.circuit, place: x.place, country: x.country, date: x.date } : null;
    })(),
    teams: Object.values(teams).map(t => ({ name: t.name, code: TEAMS[t.name] || t.name.slice(0, 3).toUpperCase(), drivers: teamDrivers[t.name] || [], pts: fill(t.pts) })),
    drivers: Object.values(drivers).map(d => {
      const o = of1[d.name] || {};
      const p = prevD[d.name] || {};
      return {
        name: d.name, code: d.code || o.code || p.code || d.name.split(' ').pop().slice(0, 3).toUpperCase(), team: d.team,
        num: o.num != null ? o.num : (p.num != null ? p.num : null),
        photo: f1p[o.f1id] || f1p[f1IdGuess(d.name)] || (p.photo && p.photo.includes('/image/upload/') ? p.photo : null) || o.photo || p.photo || null,
        pts: fill(d.pts), pos: fill(d.pos), dnf: fill(d.dnf),
      };
    }),
  };

  // Plausibilitätsprüfung: lieber nichts speichern als kaputte Daten
  const problems = [];
  if (out.drivers.length < 20) problems.push(`nur ${out.drivers.length} Fahrer erkannt (erwartet ca. 22)`);
  if (out.teams.length < 10) problems.push(`nur ${out.teams.length} Teams erkannt (erwartet 11)`);
  if (existing === 0) problems.push('keine Runden im Fantasy-Feed gefunden');
  if (prev && existing < prevLast) problems.push(`Feed liefert nur ${existing} Runden, beim letzten Mal waren es ${prevLast}`);
  if (problems.length) {
    console.error('\nDaten wirken unvollständig, es wird NICHT gespeichert:\n - ' + problems.join('\n - '));
    if (unknownAll.size) console.error('Nicht erkannte Einträge:', [...unknownAll].slice(0, 15).join(', '));
    console.error('Tipp: Mit "node scripts/fetch-data.js --debug" siehst du den Aufbau des Feeds. Schick mir diese Ausgabe, dann passe ich das Skript an.');
    process.exit(1);
  }
  if (unknownAll.size) log('Hinweis, nicht zugeordnet:', [...unknownAll].slice(0, 15).join(', '));
  log(`Ergebnis: ${out.drivers.length} Fahrer, ${out.teams.length} Teams, ${lastScored} Rennen ausgewertet`);

  if (DRY) { log('Testlauf beendet, nichts gespeichert.'); return out; }
  await save(out);
  log('Gespeichert.');
  return out;
}

module.exports = { main, parseFantasyRound, parseResults, canonDriver, canonTeam, findPlayers };
if (require.main === module) main().catch(e => { console.error('Fehler:', e.message); process.exit(1); });
