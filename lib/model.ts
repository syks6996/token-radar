// The token radar's model, version 2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures. No protocol name is ever special-cased:
// the same function scores every row. The formula, stated in full in the dashboard:
//
//   base        = tvl_usd x BASE_MULTIPLE
//   growth      = clamp(change_7d, -60, 150) per cent
//   growthMult  = 1 + (growth / 100) x (growth >= 0 ? 0.6 : 0.3)
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   category    = a sector multiple, 0.85 to 1.15, by the protocol's DefiLlama category
//   breadth     = 1 + 0.01 x min(chains - 1, 10)
//   implied     = max(1, round(base x growthMult x maturity x category x breadth))
//
// Why each factor is there:
// - TVL is the size of the economy a token would price. The base multiple (0.25) is the model's
//   claim that a launch prices at roughly a quarter of the value already locked.
// - Growth is asymmetric on purpose: a protocol gaining TVL week over week is compounding
//   attention, so positive growth earns the full weight; a falling one is penalised at half
//   weight, because a seven-day dip is noisy and a launch does not wait for a green week.
// - Maturity is how long the protocol has run with no token. A launch is more pent-up the longer
//   the wait, so the factor rises from 0.6 for a brand-new listing to 1.0 after three years.
// - Category is a sector multiple: token launches price differently by sector (perpetuals and
//   lending markets launch dearer than bridges, which mostly pass value through). It is a model
//   parameter keyed on DefiLlama's category, never on a name.
// - Breadth is distribution: a protocol live on more chains reaches more farmers, so each extra
//   chain past the first adds one per cent, capped at ten per cent.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the page recomputes them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight_pos: number;
  growth_weight_neg: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight_pos: 0.6,
  growth_weight_neg: 0.3,
  growth_floor: -60,
  growth_cap: 150,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.01,
  breadth_max: 0.1,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * The sector multiple, by DefiLlama category (lowercase substring match, first match in this
 * order wins). A model parameter, not a list of names: every protocol in a sector gets the same
 * number, and a protocol with no listed category gets 1.0.
 */
export const CATEGORY_MULTIPLIERS: Array<[string, number]> = [
  ['perpetual', 1.15],
  ['derivative', 1.15],
  ['basis trading', 1.15],
  ['lending', 1.1],
  ['cdp', 1.1],
  ['collateral', 1.1],
  ['rwa', 1.1],
  ['risk curator', 1.1],
  ['capital allocator', 1.1],
  ['dex', 1.05],
  ['yield', 1.05],
  ['restaking', 1.05],
  ['liquid staking', 1.0],
  ['staking', 1.0],
  ['bridge', 0.9],
  ['cex', 0.85],
];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  breadth_multiplier: number;
  on_watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's share of the board: how many protocols, how much value, and the strongest one. */
export interface CategorySummary {
  category: string;
  count: number;
  total_tvl_usd: number;
  total_implied_usd: number;
  top_slug: string;
  top_name: string;
  top_implied_usd: number;
  avg_growth_pct: number;
}

/** One protocol's seven-day move: the board's biggest gainers and losers by TVL change. */
export interface Mover {
  slug: string;
  name: string;
  rank: number;
  change_7d: number;
  tvl_usd: number;
  implied_value_usd: number;
}

/** The board's headline figures: totals, the median row, and the split by token status. */
export interface BoardStats {
  total_implied_usd: number;
  median_implied_usd: number;
  total_tvl_usd: number;
  watchlist_implied_usd: number;
  early_implied_usd: number;
  chains_covered: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  summary: CategorySummary[];
  movers: { gainers: Mover[]; losers: Mover[] };
  longest_wait: LongestWait[];
  stats: BoardStats;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The sector multiple for a category: first matching key wins, 1.0 when nothing matches. */
export function categoryMultiplier(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  for (const [key, mult] of CATEGORY_MULTIPLIERS) {
    if (c.includes(key)) return mult;
  }
  return 1.0;
}

/** The distribution multiple for a chain list: one per cent per extra chain, capped. */
export function breadthMultiplier(chains: string[]): number {
  const extra = Math.max(0, chains.length - 1);
  return 1 + Math.min(extra, Math.round(MODEL.breadth_max / MODEL.breadth_step)) * MODEL.breadth_step;
}

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; categoryMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const weight = growthPct >= 0 ? model.growth_weight_pos : model.growth_weight_neg;
  const growthMult = 1 + (growthPct / 100) * weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const categoryMult = categoryMultiplier(protocol.category);
  const breadthMult = breadthMultiplier(protocol.chains);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * categoryMult * breadthMult));
  return { implied, growthPct, growthMult, maturityMult, categoryMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, maturityMult, categoryMult, breadthMult, age } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, growthPct, growthMult, maturityMult, categoryMult, breadthMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      category_multiplier: round4(s.categoryMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    on_watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
    summary: categorySummary(board),
    movers: topMovers(board),
    longest_wait: longestRunning(board),
    stats: boardStats(board, snapshot),
  };
  return { board, radar };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one transaction costs on a chain, from the chain's own fee market. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $8 of gas on Ethereum mainnet';
  if (c === 'solana') return 'about $0.05 of gas on Solana';
  if (c === 'bitcoin') return 'about $3 of gas on Bitcoin';
  if (c === 'tron') return 'about $1 of gas on Tron';
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'binance' || c === 'monad' || c === 'hyperliquid l1' || c === 'avalanche' || c === 'sui' || c === 'sei' || c === 'berachain' || c === 'sonic') return `about $0.50 of gas on ${chain}`;
  return `about $2 of gas on ${chain}`;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('chain')) return `Use ${name} on ${chain} with $${capital} of activity and keep the wallet funded.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, complementary action for the same category: airdrops reward breadth, not one click. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(10, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${half} against the deposit on ${name} and repay it a week later, so the wallet shows both sides of the market.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${half} through ${name} on ${chain} and add the proceeds to the pool, so the wallet shows trading as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge $${half} back through ${name} after a week, so the wallet shows a round trip rather than a one-way move.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim or restake the staking rewards from ${name} once, so the wallet shows a reward event.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Close the hedge on ${name} and open a fresh one a week later, so the wallet shows repeated use.`;
  if (c.includes('prediction')) return `Settle one market on ${name} and place a second position, so the wallet shows more than a single bet.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${half} more into a second ${name} vault on ${chain} and keep both shares.`;
  if (c.includes('stable')) return `Swap $${half} of the stable asset back through ${name} on ${chain} and re-deposit it.`;
  if (c.includes('rwa')) return `Check the yield accrued on the ${name} asset and compound it once before the hold ends.`;
  if (c.includes('insurance')) return `Renew or top up the ${name} cover once, so the wallet shows an ongoing policy.`;
  return `Make a second $${half} deposit into ${name} on ${chain} a week after the first.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Gas is priced for the protocol's own first chain, so an Ethereum farm and a Solana farm
 * do not pretend to cost the same.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${Math.max(10, Math.round(capital / 2))} of capital and ${gas}`,
      time: '15 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Verify every contract address from the protocol's own documentation before you sign, and ignore any direct message that offers a claim link.`,
      cost: 'nothing but the check',
      time: '5 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** The board grouped by category, strongest total implied value first. */
export function categorySummary(board: BoardRow[]): CategorySummary[] {
  const by = new Map<string, { s: CategorySummary; growthSum: number; growthN: number }>();
  for (const r of board) {
    const key = r.category ?? 'Other';
    let entry = by.get(key);
    if (!entry) {
      entry = {
        s: { category: key, count: 0, total_tvl_usd: 0, total_implied_usd: 0, top_slug: r.slug, top_name: r.name, top_implied_usd: r.implied_value_usd, avg_growth_pct: 0 },
        growthSum: 0,
        growthN: 0,
      };
      by.set(key, entry);
    }
    entry.s.count += 1;
    entry.s.total_tvl_usd += r.tvl_usd;
    entry.s.total_implied_usd += r.implied_value_usd;
    if (r.implied_value_usd > entry.s.top_implied_usd) {
      entry.s.top_slug = r.slug;
      entry.s.top_name = r.name;
      entry.s.top_implied_usd = r.implied_value_usd;
    }
    if (r.change_7d !== null) {
      entry.growthSum += r.change_7d;
      entry.growthN += 1;
    }
  }
  const out: CategorySummary[] = [];
  for (const entry of by.values()) {
    entry.s.avg_growth_pct = entry.growthN > 0 ? Math.round((entry.growthSum / entry.growthN) * 100) / 100 : 0;
    out.push(entry.s);
  }
  out.sort((a, b) => b.total_implied_usd - a.total_implied_usd || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return out;
}

/** One protocol's wait: how long it has run with no token, and what it would be worth. */
export interface LongestWait {
  slug: string;
  name: string;
  rank: number;
  age_days: number | null;
  tvl_usd: number;
  implied_value_usd: number;
}

/** The board's biggest seven-day movers: the five strongest gainers and the five steepest losers. */
export function topMovers(board: BoardRow[]): { gainers: Mover[]; losers: Mover[] } {
  const moved = board.filter((r) => r.change_7d !== null);
  const toMover = (r: BoardRow): Mover => ({ slug: r.slug, name: r.name, rank: r.rank, change_7d: r.change_7d!, tvl_usd: r.tvl_usd, implied_value_usd: r.implied_value_usd });
  const gainers = moved
    .filter((r) => (r.change_7d ?? 0) > 0)
    .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0))
    .slice(0, 5)
    .map(toMover);
  const losers = moved
    .filter((r) => (r.change_7d ?? 0) < 0)
    .sort((a, b) => (a.change_7d ?? 0) - (b.change_7d ?? 0))
    .slice(0, 5)
    .map(toMover);
  return { gainers, losers };
}

/** The protocols that have waited longest with no token: the pent-up launches. */
export function longestRunning(board: BoardRow[]): LongestWait[] {
  return board
    .filter((r) => r.age_days !== null)
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0) || b.implied_value_usd - a.implied_value_usd)
    .slice(0, 5)
    .map((r) => ({ slug: r.slug, name: r.name, rank: r.rank, age_days: r.age_days, tvl_usd: r.tvl_usd, implied_value_usd: r.implied_value_usd }));
}

/** The board's headline figures: totals, the median row, and the watchlist/early split. */
export function boardStats(board: BoardRow[], snapshot: Snapshot): BoardStats {
  const values = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const mid = values.length === 0 ? 0 : values[Math.floor(values.length / 2)]!;
  const chains = new Set<string>();
  for (const r of board) for (const c of r.chains) chains.add(c);
  let watchlistImplied = 0;
  let earlyImplied = 0;
  let totalTvl = 0;
  for (const r of board) {
    totalTvl += r.tvl_usd;
    if (snapshot.watchlist.includes(r.slug)) watchlistImplied += r.implied_value_usd;
    else earlyImplied += r.implied_value_usd;
  }
  return {
    total_implied_usd: values.reduce((a, b) => a + b, 0),
    median_implied_usd: mid,
    total_tvl_usd: totalTvl,
    watchlist_implied_usd: watchlistImplied,
    early_implied_usd: earlyImplied,
    chains_covered: chains.size,
  };
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
