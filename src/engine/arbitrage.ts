import type { ExchangeState } from "../market/marketStore.js";

export type Fee = {
  taker: number; // e.g. 0.001 = 0.1%
};

export const fees: Record<string, Fee> = {
  nobitex: { taker: 0.0 },
  bitpin: { taker: 0.0 },
};

export type ArbitrageOpportunity = {
  buyEx: ExchangeState;
  sellEx: ExchangeState;
  buyFrom: string;
  sellTo: string;
  profit: number;
  effectiveBuyPrice: number;
  effectiveSellPrice: number;
};

const calculateArbitrage = (
  snapshot: ExchangeState[],
): ArbitrageOpportunity | null => {
  let best: ArbitrageOpportunity | null = null;

  for (const buyEx of snapshot) {
    for (const sellEx of snapshot) {
      if (buyEx.exchange === sellEx.exchange) continue;

      // Prefer VWAP for EXEC_QUANTITY; fall back to top-of-book when depth is thin
      // (otherwise both sides null and no pair ever qualifies).
      const rawBuyPx = buyEx.buy ?? buyEx.bestAsk;
      const rawSellPx = sellEx.sell ?? sellEx.bestBid;
      if (rawBuyPx === null || rawSellPx === null) continue;

      const buyFee = fees[buyEx.exchange]?.taker ?? 0;
      const sellFee = fees[sellEx.exchange]?.taker ?? 0;

      const effectiveBuyPrice = rawBuyPx * (1 + buyFee);
      const effectiveSellPrice = rawSellPx * (1 - sellFee);

      const profit = effectiveSellPrice - effectiveBuyPrice;

      if (!best || profit > best.profit) {
        best = {
          buyEx,
          sellEx,
          buyFrom: buyEx.exchange,
          sellTo: sellEx.exchange,
          profit,
          effectiveBuyPrice,
          effectiveSellPrice,
        };
      }
    }
  }

  if (!best || best.profit <= 0) return null;

  return best;
};

export default calculateArbitrage;
