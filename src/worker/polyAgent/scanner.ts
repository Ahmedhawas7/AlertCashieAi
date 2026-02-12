import { PolySettings } from './state';

export type PolyOpportunity = {
  market: string;
  yes: number;
  no: number;
  sum: number;
  mispricingPct: number;
  note: string;
};

export async function scanPolymarketMVP(settings: PolySettings): Promise<PolyOpportunity[]> {
  // Demo opportunity to verify plumbing end-to-end.
  // We'll wire real Polymarket APIs after MVP works.
  const yes = 0.44;
  const no = 0.48;
  const sum = yes + no;
  const mispricingPct = Math.max(0, (1 - sum) * 100);

  if (mispricingPct < settings.minMispricingPct) return [];
  return [{
    market: "MVP Demo Market",
    yes,
    no,
    sum,
    mispricingPct,
    note: "Demo فقط للتأكد إن أوامر PolyAgent شغالة. الخطوة الجاية: توصيل Polymarket APIs."
  }];
}
