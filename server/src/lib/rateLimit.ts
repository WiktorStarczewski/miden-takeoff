// Token-budget rate limiting backed by Cloudflare KV.
//
// Two windows are tracked per UTC day:
//   - Global  (key: `chat:tokens:global:<day>`)            — protects the bill
//   - Per-IP  (key: `chat:tokens:ip:<ip>:<day>`)           — fairness across users
//
// Notes:
//   * KV is eventually consistent; concurrent requests can overshoot the cap by
//     up to N × max_tokens. Acceptable as a soft cap. For a hard cap, replace
//     this with a Durable Object exposing atomic check-and-debit.
//   * In non-Worker contexts (local `tsx` dev) the env binding is absent and
//     these calls become no-ops, so chat keeps working without a KV namespace.

const KV_TTL_SECONDS = 60 * 60 * 36; // 36h — survives the day rollover

const GLOBAL_DAILY_BUDGET = Number(
  process.env.GLOBAL_DAILY_BUDGET ?? "1000000",
);
const PER_IP_DAILY_BUDGET = Number(process.env.PER_IP_DAILY_BUDGET ?? "100000");

type KVLike = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ) => Promise<void>;
};

async function getKV(): Promise<KVLike | null> {
  try {
    const mod = (await import("cloudflare:workers")) as unknown as {
      env: { BUDGET?: KVLike };
    };
    return mod.env.BUDGET ?? null;
  } catch {
    return null;
  }
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function globalKey(day: string): string {
  return `chat:tokens:global:${day}`;
}

function ipKey(ip: string, day: string): string {
  return `chat:tokens:ip:${ip}:${day}`;
}

export type BudgetCheck =
  | { ok: true }
  | { ok: false; scope: "global" | "ip"; used: number; limit: number };

export async function checkBudget(ip: string): Promise<BudgetCheck> {
  const kv = await getKV();
  if (!kv) return { ok: true };

  const day = dayKey();
  const [globalUsedRaw, ipUsedRaw] = await Promise.all([
    kv.get(globalKey(day)),
    kv.get(ipKey(ip, day)),
  ]);
  const globalUsed = Number(globalUsedRaw ?? 0);
  const ipUsed = Number(ipUsedRaw ?? 0);

  if (globalUsed >= GLOBAL_DAILY_BUDGET) {
    return {
      ok: false,
      scope: "global",
      used: globalUsed,
      limit: GLOBAL_DAILY_BUDGET,
    };
  }
  if (ipUsed >= PER_IP_DAILY_BUDGET) {
    return {
      ok: false,
      scope: "ip",
      used: ipUsed,
      limit: PER_IP_DAILY_BUDGET,
    };
  }
  return { ok: true };
}

export async function recordUsage(ip: string, tokens: number): Promise<void> {
  if (tokens <= 0) return;
  const kv = await getKV();
  if (!kv) return;

  const day = dayKey();
  const gKey = globalKey(day);
  const iKey = ipKey(ip, day);

  const [gRaw, iRaw] = await Promise.all([kv.get(gKey), kv.get(iKey)]);

  const gNext = Number(gRaw ?? 0) + tokens;
  const iNext = Number(iRaw ?? 0) + tokens;

  await Promise.all([
    kv.put(gKey, String(gNext), { expirationTtl: KV_TTL_SECONDS }),
    kv.put(iKey, String(iNext), { expirationTtl: KV_TTL_SECONDS }),
  ]);
}
