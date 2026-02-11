import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAM_OPTIONS } from '../src/data/teamConfig.js';
import { canonicalizePositionGroup } from '../src/data/normalize/positionMapping.js';

const API_BASE = 'https://api.collegefootballdata.com';
const SEASON = Number(process.env.CFBD_SEASON ?? 2025);
const RECRUITING_YEARS = [SEASON, SEASON - 1, SEASON - 2, SEASON - 3, SEASON - 4];
const API_KEY = process.env.CFBD_API_KEY;

if (!API_KEY) {
  console.error('Missing CFBD_API_KEY. Set it in environment before running this script.');
  process.exit(1);
}

const TEAM_QUERY_BY_ID = {
  'miami-hurricanes': 'Miami',
  'alabama-crimson-tide': 'Alabama'
};

const TEAM_247_SLUG_BY_ID = {
  'miami-hurricanes': 'miami',
  'alabama-crimson-tide': 'alabama'
};

const OURLADS_QUERY_BY_ID = {
  'miami-hurricanes': { s: 'miami', slug: 'miami', id: '91073' },
  'alabama-crimson-tide': { s: 'alabama', slug: 'alabama', id: '89923' }
};

const OFFENSE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG']);
const DEFENSE_POSITIONS = new Set(['DE', 'DT', 'NT', 'DL', 'LB', 'CB', 'S', 'DB']);
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

const OURLADS_DIRECT_SLOT_MAP = {
  'WR-X': 'WRX',
  'WR-Z': 'WRZ',
  'WR-SL': 'SLOT',
  'WR-H': 'SLOT',
  SLOT: 'SLOT',
  LT: 'LT',
  LG: 'LG',
  C: 'C',
  RG: 'RG',
  RT: 'RT',
  TE: 'TE',
  'H-BACK': 'TE',
  QB: 'QB',
  RB: 'RB',
  HB: 'RB',
  TB: 'RB',
  FB: 'RB',
  LDE: 'LDE',
  NT: 'NT',
  DT: 'DT',
  RDE: 'RDE',
  WLB: 'WLB',
  MLB: 'MLB',
  NB: 'NB',
  LCB: 'LCB',
  SS: 'SS',
  FS: 'FS',
  RCB: 'RCB'
};

const OURLADS_SLOT_CHAINS = {
  OFF: {
    WR: ['WRX', 'SLOT', 'WRZ'],
    QB: ['QB'],
    RB: ['RB'],
    TE: ['TE'],
    OL: ['LT', 'LG', 'C', 'RG', 'RT'],
    T: ['LT', 'RT'],
    G: ['LG', 'RG'],
    C: ['C']
  },
  DEF: {
    DE: ['LDE', 'RDE'],
    DT: ['NT', 'DT'],
    LB: ['WLB', 'MLB', 'NB'],
    MLB: ['MLB'],
    WLB: ['WLB'],
    SLB: ['NB'],
    CB: ['LCB', 'RCB'],
    NB: ['NB'],
    S: ['SS', 'FS'],
    SS: ['SS'],
    FS: ['FS'],
    DB: ['LCB', 'RCB', 'NB']
  }
};

const decodeHtml = (text = '') => text
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripTags = (text = '') => decodeHtml(String(text).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const normalizePosition = (value = '') => {
  const pos = String(value).trim().toUpperCase();
  if (pos === 'SAF') return 'S';
  if (pos === 'OLB' || pos === 'ILB') return 'LB';
  if (pos === 'EDGE') return 'DE';
  if (pos === 'IDL') return 'DT';
  const canonical = canonicalizePositionGroup(pos);
  if (canonical === 'T') return 'OT';
  if (canonical === 'G') return 'OG';
  if (canonical === 'SLB' || canonical === 'MLB' || canonical === 'WLB') return 'LB';
  if (canonical === 'CB' || canonical === 'NB') return 'CB';
  if (canonical === 'FS' || canonical === 'SS') return 'S';
  return canonical;
};

const normalizeClassYear = (value) => {
  if (value == null) return 'SO';
  const text = String(value).trim().toUpperCase();
  if (['FR', 'SO', 'JR', 'SR'].includes(text)) return text;
  if (text === '1') return 'FR';
  if (text === '2') return 'SO';
  if (text === '3') return 'JR';
  if (text === '4') return 'SR';
  if (text === '5' || text === '6') return 'RS SR';
  if (text === 'RS FR') return 'RS FR';
  if (text === 'RS SO') return 'RS SO';
  if (text === 'RS JR') return 'RS JR';
  if (text === 'RS SR') return 'RS SR';
  return text;
};

const toHeight = (value) => {
  if (!value) return '6\'0"';
  const text = String(value);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const inches = Number(text);
    const feet = Math.floor(inches / 12);
    const rem = Math.round((inches % 12) * 10) / 10;
    const cleanRem = Number.isInteger(rem) ? String(rem) : String(rem).replace(/\.0$/, '');
    return `${feet}'${cleanRem}"`;
  }
  const dash = text.match(/^(\d+)-(\d+(?:\.\d+)?)$/);
  if (dash) return `${dash[1]}'${dash[2]}"`;
  const feetInches = text.match(/^(\d)'(\d{1,2})"?$/);
  if (feetInches) return `${feetInches[1]}'${feetInches[2]}"`;
  return text;
};

const classifySide = (position) => {
  if (OFFENSE_POSITIONS.has(position)) return 'OFF';
  if (DEFENSE_POSITIONS.has(position)) return 'DEF';
  return 'ST';
};

const cleanName = (value = '') => {
  const tokens = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,'’`\-]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !NAME_SUFFIXES.has(token));

  return tokens.join(' ').trim();
};

const levenshtein = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

const similarity = (a, b) => {
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
};

const buildRosterNameIndex = (rosterPlayers) => ({
  rosterByCleanName: new Map(
    rosterPlayers.map((player) => [cleanName(player.name), { playerId: player.playerId, name: player.name }])
  ),
  rosterNamePairs: rosterPlayers.map((player) => ({ playerId: player.playerId, cleanedName: cleanName(player.name), name: player.name }))
});

const resolveRosterPlayerIdByCleanName = ({ cleanedName, rosterByCleanName, rosterNamePairs, threshold = 0.82 }) => {
  if (!cleanedName) return null;

  const direct = rosterByCleanName.get(cleanedName);
  if (direct) return { playerId: direct.playerId, method: 'exact-clean' };

  let best = null;
  const recruitLastToken = cleanedName.split(' ').slice(-1)[0];
  for (const candidate of rosterNamePairs) {
    const sim = similarity(cleanedName, candidate.cleanedName);
    if (sim < threshold) continue;
    const sameLastToken = recruitLastToken === candidate.cleanedName.split(' ').slice(-1)[0];
    if (!sameLastToken) continue;
    if (!best || sim > best.sim) best = { ...candidate, sim };
  }

  if (best) return { playerId: best.playerId, method: 'fuzzy-clean', similarity: Number(best.sim.toFixed(3)) };
  return null;
};

const toPlayerId = (id, firstName, lastName) => {
  const safeName = `${firstName ?? ''}${lastName ?? ''}`.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `CFBD-${id ?? safeName.slice(0, 16)}`;
};

const sortByClassDesc = (a, b) => {
  const rank = (year) => {
    const normalized = normalizeClassYear(year).replace('RS ', '');
    return { SR: 4, JR: 3, SO: 2, FR: 1 }[normalized] ?? 0;
  };
  return rank(b.classYear) - rank(a.classYear);
};

const pickSlots = (players, slotDefs) => {
  const used = new Set();
  const result = {};

  const pickForSlot = (allowedPositions) => {
    const direct = players.find((p) => !used.has(p.playerId) && allowedPositions.includes(p.position));
    if (direct) return direct;
    return players.find((p) => !used.has(p.playerId));
  };

  for (const depth of [1, 2]) {
    for (const [slot, allowedPositions] of slotDefs) {
      const picked = pickForSlot(allowedPositions);
      if (!picked) continue;
      const key = depth === 1 ? slot : `${slot}${depth}`;
      result[key] = picked.playerId;
      used.add(picked.playerId);
    }
  }

  return result;
};

const buildDepthChart = (players) => {
  const offense = players.filter((p) => p.side === 'OFF').sort(sortByClassDesc);
  const defense = players.filter((p) => p.side === 'DEF').sort(sortByClassDesc);

  const offenseSlots = [
    ['LT', ['LT', 'OT', 'OL']],
    ['LG', ['LG', 'OG', 'OL']],
    ['C', ['C', 'OL']],
    ['RG', ['RG', 'OG', 'OL']],
    ['RT', ['RT', 'OT', 'OL']],
    ['WRX', ['WR']],
    ['SLOT', ['WR']],
    ['QB', ['QB']],
    ['RB', ['RB']],
    ['TE', ['TE']],
    ['WRZ', ['WR']]
  ];

  const defenseSlots = [
    ['LDE', ['DE', 'DL']],
    ['NT', ['NT', 'DT', 'DL']],
    ['DT', ['DT', 'DL']],
    ['RDE', ['DE', 'DL']],
    ['LCB', ['CB', 'DB']],
    ['SS', ['S', 'DB']],
    ['WLB', ['LB']],
    ['MLB', ['LB']],
    ['NB', ['LB', 'DB']],
    ['FS', ['S', 'DB']],
    ['RCB', ['CB', 'DB']]
  ];

  return {
    offense: pickSlots(offense, offenseSlots),
    defense: pickSlots(defense, defenseSlots)
  };
};

const statMapByCategory = {
  passing: [
    ['YDS', 'PAS'],
    ['TD', 'TD'],
    ['INT', 'INT'],
    ['RATING', 'RTG'],
    ['QBR', 'RTG']
  ],
  rushing: [
    ['YDS', 'YDS'],
    ['TD', 'TD'],
    ['ATT', 'ATT']
  ],
  receiving: [
    ['REC', 'REC'],
    ['YDS', 'YDS'],
    ['TD', 'TD']
  ],
  defensive: [
    ['TACKLE', 'TKL'],
    ['TFL', 'TFL'],
    ['SACK', 'SCK'],
    ['INT', 'INT'],
    ['PBU', 'PD'],
    ['BREAKUP', 'PD']
  ]
};

const mapStatKey = (category, statType) => {
  const rules = statMapByCategory[String(category ?? '').toLowerCase()] ?? [];
  const upperStat = String(statType ?? '').toUpperCase();
  const match = rules.find(([needle]) => upperStat.includes(needle));
  return match?.[1] ?? null;
};

const aggregateProduction = (statsRows, nameToPlayerId, season, rosterPlayerIds, rosterNameById) => {
  const byPlayer = new Map();
  const rosterIdSet = new Set(rosterPlayerIds);

  for (const row of statsRows) {
    const numeric = Number(row.stat);
    if (Number.isNaN(numeric)) continue;

    const key = mapStatKey(row.category, row.statType);
    if (!key) continue;

    const playerId = row.playerId ? `CFBD-${row.playerId}` : nameToPlayerId.get(String(row.player ?? '').trim().toLowerCase());
    if (!playerId || !rosterIdSet.has(playerId)) continue;

    if (!byPlayer.has(playerId)) byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? row.player ?? null });
    const target = byPlayer.get(playerId);

    if (key === 'RTG') {
      target[key] = Number(numeric.toFixed(1));
    } else {
      target[key] = Number(((target[key] ?? 0) + numeric).toFixed(1));
    }
  }

  for (const playerId of rosterPlayerIds) {
    if (!byPlayer.has(playerId)) byPlayer.set(playerId, { playerId, name: rosterNameById.get(playerId) ?? null });
  }

  return {
    sourceId: 'cfbd-production-v1',
    sourceType: 'production',
    asOf: new Date().toISOString().slice(0, 10),
    season,
    version: 'cfbd-2026.1',
    playerProduction: [...byPlayer.values()]
  };
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CFBD request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`);
  }

  return response.json();
};

const fetch247Page = async ({ teamSlug, year }) => {
  const url = `https://247sports.com/college/${teamSlug}/season/${year}-football/commits/`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`247 request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`);
  }

  return response.text();
};

const fetchOurladsDepthChartPage = async ({ teamOption }) => {
  const query = OURLADS_QUERY_BY_ID[teamOption.id];
  if (!query) {
    throw new Error(`Missing Ourlads lookup for ${teamOption.id}`);
  }

  const urls = [
    (() => {
      const url = new URL('https://www.ourlads.com/ncaa-football-depth-charts/depth-chart.aspx');
      url.searchParams.set('s', query.s);
      url.searchParams.set('id', query.id);
      return url;
    })(),
    new URL(`https://www.ourlads.com/ncaa-football-depth-charts/depth-chart/${query.slug}/${query.id}`)
  ];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
  };

  let lastError = null;
  for (const url of urls) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Ourlads request failed (${response.status}): ${url} :: ${text.slice(0, 200)}`);
        }

        return {
          url: url.toString(),
          html: await response.text()
        };
      } catch (error) {
        lastError = error;
        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        }
      }
    }
  }

  throw lastError ?? new Error(`Ourlads request failed for ${teamOption.id}`);
};

const parseOurladsName = (text) => {
  const plain = stripTags(text).trim();
  if (!plain) return null;

  const withoutYear = plain
    .replace(/\s+(?:RS\s+)?(?:FR|SO|JR|SR|GR)(?:\s*\/\s*TR)?$/i, '')
    .replace(/\s+TR$/i, '')
    .trim();
  if (!withoutYear) return null;

  if (withoutYear.includes(',')) {
    const [last, first] = withoutYear.split(',').map((part) => part.trim());
    return `${first} ${last}`.replace(/\s+/g, ' ').trim();
  }

  return withoutYear.replace(/\s+/g, ' ').trim();
};

const parseOurladsDepthTable = (tbodyHtml) => {
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(tbodyHtml))) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    if (cells.length < 3) continue;

    const position = stripTags(cells[0]).toUpperCase().replace(/\s+/g, '');
    const players = [];
    for (let depth = 1; depth <= 5; depth += 1) {
      const nameCell = cells[depth * 2];
      const parsedName = parseOurladsName(nameCell ?? '');
      players.push(parsedName);
    }

    rows.push({ position, players });
  }

  return rows;
};

const extractOurladsSectionRows = ({ html, tbodyId }) => {
  const pattern = new RegExp(`<tbody id="${tbodyId}">([\\s\\S]*?)<\\/tbody>`, 'i');
  const match = html.match(pattern);
  if (!match) return [];
  return parseOurladsDepthTable(match[1]);
};

const normalizeDepthPositionToken = (value = '') =>
  String(value).toUpperCase().trim().replace(/\s+/g, '').replace(/_/g, '-');

const resolveOurladsSlot = ({ rawPosition, side, usedSlots }) => {
  const token = normalizeDepthPositionToken(rawPosition);
  const direct = OURLADS_DIRECT_SLOT_MAP[token];
  if (direct) return direct;

  const positionGroup = canonicalizePositionGroup(token);
  const chain = OURLADS_SLOT_CHAINS[side]?.[positionGroup];
  if (!chain?.length) return null;

  return chain.find((slot) => !usedSlots.has(slot)) ?? chain[0];
};

const mapOurladsDepthToRoster = ({ rows, side, rosterByCleanName, rosterNamePairs }) => {
  const slots = {};
  const unmatched = [];
  const usedSlots = new Set();

  for (const row of rows) {
    const canonicalSlot = resolveOurladsSlot({ rawPosition: row.position, side, usedSlots });
    if (!canonicalSlot) continue;
    usedSlots.add(canonicalSlot);

    row.players.forEach((name, idx) => {
      if (!name) return;
      const cleanedName = cleanName(name);
      const resolved = resolveRosterPlayerIdByCleanName({
        cleanedName,
        rosterByCleanName,
        rosterNamePairs
      });

      if (!resolved) {
        unmatched.push({ slot: canonicalSlot, depth: idx + 1, name, cleanedName });
        return;
      }

      const key = idx === 0 ? canonicalSlot : `${canonicalSlot}${idx + 1}`;
      slots[key] = resolved.playerId;
    });
  }

  return { slots, unmatched };
};

const buildDepthChartFromOurlads = ({ html, rosterPlayers }) => {
  const { rosterByCleanName, rosterNamePairs } = buildRosterNameIndex(rosterPlayers);
  const offenseRows = extractOurladsSectionRows({ html, tbodyId: 'ctl00_phContent_dcTBody' });
  const defenseRows = extractOurladsSectionRows({ html, tbodyId: 'ctl00_phContent_dcTBody2' });

  const offenseMapped = mapOurladsDepthToRoster({
    rows: offenseRows,
    side: 'OFF',
    rosterByCleanName,
    rosterNamePairs
  });
  const defenseMapped = mapOurladsDepthToRoster({
    rows: defenseRows,
    side: 'DEF',
    rosterByCleanName,
    rosterNamePairs
  });

  return {
    depthChart: {
      offense: offenseMapped.slots,
      defense: defenseMapped.slots
    },
    unmatched: [...offenseMapped.unmatched, ...defenseMapped.unmatched],
    parsedRows: {
      offense: offenseRows.length,
      defense: defenseRows.length
    }
  };
};

const parse247ClassSummary = (html) => {
  const ranks = {};
  const pattern = /<div class="ir-bar__ranks">\s*<h3>([^<]+)<\/h3>\s*<span class="ir-bar__number">([^<]+)<\/span>/g;
  let match;
  while ((match = pattern.exec(html))) {
    const label = stripTags(match[1]).toLowerCase();
    const value = Number(stripTags(match[2]).replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(value)) continue;
    if (label.includes('composite')) ranks.compositeRank = value;
    if (label.includes('overall')) ranks.overallRank = value;
    if (label.includes('transfer')) ranks.transferRank = value;
  }
  return ranks;
};

const parse247Commits = (html) => {
  const rows = [];
  const split = html.split('<li class="ri-page__list-item">').slice(1);

  for (const item of split) {
    const row = item.split('</li>')[0];
    if (!row.includes('ri-page__name-link')) continue;

    const nameMatch = row.match(/class="ri-page__name-link"[^>]*href="([^"]+)"[^>]*>([^<]+)</);
    if (!nameMatch) continue;

    const href = decodeHtml(nameMatch[1]);
    const name = stripTags(nameMatch[2]);
    const idMatch = href.match(/-(\d+)\/?$/);
    const player247Id = idMatch ? idMatch[1] : null;

    const metrics = stripTags((row.match(/<div class="metrics">([\s\S]*?)<\/div>/) || [])[1] || '');
    const [heightRaw, weightRaw] = metrics.split('/').map((part) => part?.trim());

    const stars = (row.match(/icon-starsolid yellow/g) || []).length || null;
    const scoreRaw = stripTags((row.match(/<span class="score">([^<]+)<\/span>/) || [])[1] || '');
    const score = Number(scoreRaw.replace(/[^0-9.]/g, ''));

    const nationalRankRaw = stripTags((row.match(/class="natrank"[^>]*>([^<]+)</) || [])[1] || '');
    const positionRankRaw = stripTags((row.match(/class="posrank"[^>]*>([^<]+)</) || [])[1] || '');
    const positionRaw = stripTags((row.match(/<div class="position">([\s\S]*?)<\/div>/) || [])[1] || '');
    const status = stripTags((row.match(/<p class="commit-date[^"]*">([\s\S]*?)<\/p>/) || [])[1] || '');

    rows.push({
      name,
      cleanedName: cleanName(name),
      player247Id,
      playerUrl: href.startsWith('http') ? href : `https:${href}`,
      position: normalizePosition(positionRaw),
      height: toHeight(heightRaw),
      weight: Number.isFinite(Number(weightRaw)) ? Number(weightRaw) : null,
      stars,
      score: Number.isFinite(score) ? score : null,
      nationalRank: Number.isFinite(Number(nationalRankRaw)) ? Number(nationalRankRaw) : null,
      positionRank: Number.isFinite(Number(positionRankRaw)) ? Number(positionRankRaw) : null,
      status
    });
  }

  return rows;
};

const resolveRosterPlayerId = ({ recruit, rosterByCleanName, rosterNamePairs }) => {
  return resolveRosterPlayerIdByCleanName({
    cleanedName: recruit.cleanedName,
    rosterByCleanName,
    rosterNamePairs
  });
};

const buildRecruitingSource = async ({ teamOption, rosterPlayers }) => {
  const teamSlug = TEAM_247_SLUG_BY_ID[teamOption.id];
  if (!teamSlug) throw new Error(`Missing 247 team slug for ${teamOption.id}`);

  const { rosterByCleanName, rosterNamePairs } = buildRosterNameIndex(rosterPlayers);

  const recruitingPlayersByYear = {};
  const teamClassRankings = [];
  const profileByPlayerId = new Map();
  const unmatchedRecruits = [];

  for (const year of RECRUITING_YEARS) {
    const html = await fetch247Page({ teamSlug, year });
    const commits = parse247Commits(html);
    const classSummary = parse247ClassSummary(html);

    recruitingPlayersByYear[year] = commits;
    teamClassRankings.push({
      year,
      team: teamOption.label,
      source: '247sports',
      ...classSummary
    });

    for (const recruit of commits) {
      const resolved = resolveRosterPlayerId({ recruit, rosterByCleanName, rosterNamePairs });
      if (!resolved) {
        unmatchedRecruits.push({ year, name: recruit.name, cleanedName: recruit.cleanedName, player247Id: recruit.player247Id });
        continue;
      }

      const existing = profileByPlayerId.get(resolved.playerId) ?? {
        playerId: resolved.playerId,
        name: rosterPlayers.find((p) => p.playerId === resolved.playerId)?.name ?? recruit.name,
        stars: null,
        compositeRating: null,
        nationalRank: null,
        positionRank: null,
        transferPortalStars: null,
        years: [],
        matches: []
      };

      const next = {
        ...existing,
        stars: Math.max(existing.stars ?? 0, recruit.stars ?? 0) || null,
        compositeRating: Math.max(existing.compositeRating ?? 0, ((recruit.score ?? 0) / 100)) || null,
        nationalRank: existing.nationalRank == null
          ? recruit.nationalRank
          : Math.min(existing.nationalRank, recruit.nationalRank ?? existing.nationalRank),
        positionRank: existing.positionRank == null
          ? recruit.positionRank
          : Math.min(existing.positionRank, recruit.positionRank ?? existing.positionRank),
        years: [...new Set([...(existing.years ?? []), year])].sort((a, b) => b - a),
        matches: [...existing.matches, { year, method: resolved.method, similarity: resolved.similarity ?? 1, player247Id: recruit.player247Id }]
      };

      profileByPlayerId.set(resolved.playerId, next);
    }
  }

  for (const rosterPlayer of rosterPlayers) {
    if (!profileByPlayerId.has(rosterPlayer.playerId)) {
      profileByPlayerId.set(rosterPlayer.playerId, {
        playerId: rosterPlayer.playerId,
        name: rosterPlayer.name,
        stars: null,
        compositeRating: null,
        nationalRank: null,
        positionRank: null,
        transferPortalStars: null,
        years: [],
        matches: []
      });
    }
  }

  return {
    sourceId: '247sports-recruiting-v1',
    sourceType: 'recruiting',
    asOf: new Date().toISOString().slice(0, 10),
    version: '247sports-2026.1',
    team: teamOption.label,
    years: RECRUITING_YEARS,
    teamClassRankings,
    playerRecruitProfiles: [...profileByPlayerId.values()],
    recruitingPlayersByYear,
    unmatchedRecruits
  };
};

const collectTeam = async (teamOption) => {
  const teamQuery = TEAM_QUERY_BY_ID[teamOption.id] ?? teamOption.label;
  const [rosterRows, statsRows] = await Promise.all([
    fetchJson(`${API_BASE}/roster?year=${SEASON}&team=${encodeURIComponent(teamQuery)}`),
    fetchJson(`${API_BASE}/stats/player/season?year=${SEASON}&team=${encodeURIComponent(teamQuery)}`)
  ]);

  const players = rosterRows.map((row) => {
    const position = normalizePosition(row.position);
    const side = classifySide(position);
    const playerId = toPlayerId(row.id, row.firstName, row.lastName);

    return {
      playerId,
      name: `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      number: Number.isFinite(Number(row.jersey)) ? Number(row.jersey) : 0,
      side,
      position,
      classYear: normalizeClassYear(row.year),
      height: toHeight(row.height),
      weight: Number.isFinite(Number(row.weight)) ? Number(row.weight) : null,
      eligibilityRemaining: null,
      isTransfer: false
    };
  });

  const eligiblePlayers = players.filter((p) => p.side === 'OFF' || p.side === 'DEF');
  const rosterPlayerIds = eligiblePlayers.map((p) => p.playerId);
  const rosterNameById = new Map(eligiblePlayers.map((p) => [p.playerId, p.name]));
  const nameToPlayerId = new Map(eligiblePlayers.map((p) => [String(p.name).trim().toLowerCase(), p.playerId]));
  let depthChart = buildDepthChart(eligiblePlayers);
  let depthChartMeta = {
    sourceId: 'synthetic-depthchart-fallback-v1',
    sourceUrl: null,
    unmatchedOurladsPlayers: []
  };

  try {
    const ourlads = await fetchOurladsDepthChartPage({ teamOption });
    const parsedDepthChart = buildDepthChartFromOurlads({ html: ourlads.html, rosterPlayers: eligiblePlayers });
    const offenseSlotCount = Object.keys(parsedDepthChart.depthChart.offense).length;
    const defenseSlotCount = Object.keys(parsedDepthChart.depthChart.defense).length;
    const hasCoverage = offenseSlotCount >= 6 && defenseSlotCount >= 6;

    if (hasCoverage) {
      depthChart = {
        offense: {
          ...depthChart.offense,
          ...parsedDepthChart.depthChart.offense
        },
        defense: {
          ...depthChart.defense,
          ...parsedDepthChart.depthChart.defense
        }
      };
      depthChartMeta = {
        sourceId: 'ourlads-depthchart-v1',
        sourceUrl: ourlads.url,
        parsedRows: parsedDepthChart.parsedRows,
        unmatchedOurladsPlayers: parsedDepthChart.unmatched
      };
    } else {
      console.warn(`[depth-chart] ${teamOption.label}: Ourlads parse missing slot coverage, using synthetic fallback.`);
    }
  } catch (error) {
    console.warn(`[depth-chart] ${teamOption.label}: ${error.message}. Using synthetic fallback.`);
  }

  const roster = {
    sourceId: 'cfbd-roster-v1',
    sourceType: 'roster',
    asOf: new Date().toISOString().slice(0, 10),
    team: teamOption.label,
    season: SEASON,
    version: 'cfbd-2026.1',
    players: eligiblePlayers,
    depthChart,
    depthChartMeta
  };

  const production = aggregateProduction(statsRows, nameToPlayerId, SEASON, rosterPlayerIds, rosterNameById);
  const recruiting = await buildRecruitingSource({ teamOption, rosterPlayers: eligiblePlayers });

  return {
    team: teamOption,
    roster,
    production,
    recruiting,
    counts: {
      rosterPlayers: eligiblePlayers.length,
      productionPlayers: production.playerProduction.length,
      recruitingProfiles: recruiting.playerRecruitProfiles.length,
      unmatched247Recruits: recruiting.unmatchedRecruits.length,
      unmatchedOurladsDepth: roster.depthChartMeta.unmatchedOurladsPlayers.length
    }
  };
};

const toJsModule = (payload) => {
  const serialized = JSON.stringify(payload, null, 2);
  return `export const cfbdScaffoldData = ${serialized};\n`;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const collectedDir = path.join(rootDir, 'src', 'data', 'collected');

const results = await Promise.all(TEAM_OPTIONS.map((team) => collectTeam(team)));

const byTeam = Object.fromEntries(
  results.map((result) => [
    result.team.id,
    {
      roster: result.roster,
      recruiting: result.recruiting,
      production: result.production
    }
  ])
);

const scaffoldPayload = {
  updatedAt: new Date().toISOString(),
  season: SEASON,
  recruitingYears: RECRUITING_YEARS,
  byTeam
};

await mkdir(collectedDir, { recursive: true });
await writeFile(path.join(collectedDir, 'cfbdScaffoldData.js'), toJsModule(scaffoldPayload), 'utf8');

for (const result of results) {
  const teamDir = path.join(collectedDir, result.team.id);
  await mkdir(teamDir, { recursive: true });
  await writeFile(path.join(teamDir, 'roster.json'), `${JSON.stringify(result.roster, null, 2)}\n`, 'utf8');
  await writeFile(path.join(teamDir, 'recruiting.json'), `${JSON.stringify(result.recruiting, null, 2)}\n`, 'utf8');
  await writeFile(path.join(teamDir, 'production.json'), `${JSON.stringify(result.production, null, 2)}\n`, 'utf8');
}

console.log(`CFBD roster/stats + 247 recruiting collection complete for season ${SEASON}.`);
console.log(`Recruiting years: ${RECRUITING_YEARS.join(', ')}`);
for (const result of results) {
  console.log(`- ${result.team.label}: roster=${result.counts.rosterPlayers}, production=${result.counts.productionPlayers}, recruitingProfiles=${result.counts.recruitingProfiles}, unmatched247=${result.counts.unmatched247Recruits}, unmatchedOurlads=${result.counts.unmatchedOurladsDepth}`);
}
