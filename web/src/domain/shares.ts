// Tapu hisseleri: kesirlerin toplamı tam olarak 1/1 olmalı. Sunucu aynı kuralı ayrıca denetler.

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

export function parseShare(text: string): [bigint, bigint] | null {
  const compact = String(text || "").replace(/\s+/g, "");
  const match = /^(\d{1,13})(?:\/(\d{1,13}))?$/.exec(compact);
  if (!match) return null;
  const p = BigInt(match[1]), q = BigInt(match[2] ?? "1");
  return p > 0n && q > 0n && p <= q && q <= 1_000_000_000_000n ? [p, q] : null;
}

export interface ShareTotal {
  /** Toplam, "3/4" biçiminde; geçersiz hisse varsa boş. */
  text: string;
  ok: boolean;
  /** Geçersiz ya da boş hissesi olan sahiplerin adları. */
  invalid: string[];
}

export function shareTotal(owners: { name: string; share: string }[]): ShareTotal {
  if (!owners.length) return { text: "", ok: true, invalid: [] };
  if (owners.length === 1 && !String(owners[0].share || "").trim()) return { text: "1/1", ok: true, invalid: [] };
  let num = 0n, den = 1n;
  const invalid: string[] = [];
  for (const owner of owners) {
    const share = parseShare(owner.share);
    if (!share) { invalid.push(owner.name); continue; }
    const [p, q] = share;
    const n = num * q + p * den, d = den * q, g = gcd(n, d);
    num = n / g; den = d / g;
  }
  if (invalid.length) return { text: "", ok: false, invalid };
  return { text: num + "/" + den, ok: num === 1n && den === 1n, invalid };
}
