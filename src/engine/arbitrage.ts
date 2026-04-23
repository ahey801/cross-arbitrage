import type { ExchangeState } from "../market/marketStore.js";
import { Level } from "../orderbook/orderbook.js";
import Calc from "./calc.js";
import dotenv from "dotenv";

dotenv.config();

import { Decimal } from "decimal.js";

export const EXEC_QUANTITY_MAX =
  Number(process.env.EXEC_QUANTITY_MAX) > 0
    ? Number(process.env.EXEC_QUANTITY_MAX)
    : 1000;

export const EXEC_QUANTITY_MIN =
  Number(process.env.EXEC_QUANTITY_MIN) > 0
    ? Number(process.env.EXEC_QUANTITY_MIN)
    : 100;

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
  quantity: number;
  profitPerUnit: number;
  grossProfit: number;
  effectiveBuyPrice: number;
  effectiveSellPrice: number;
};

const fillableQty = (levels: Level[]): number => {
  return levels.reduce((acc, level) => acc + level.amount, 0);
};
const clampExecQty = (asks: Level[], bids: Level[], maxQty: number): number => {
  return Math.min(maxQty, fillableQty(asks), fillableQty(bids));
};

const calculateArbitrage = (
  snapshot: ExchangeState[],
): ArbitrageOpportunity | null => {
  let best: ArbitrageOpportunity | null = null;

  for (const buyEx of snapshot) {
    for (const sellEx of snapshot) {
      if (buyEx.exchange === sellEx.exchange) continue;
      if (!buyEx.asks.length || !sellEx.bids.length) continue;

      // Prefer VWAP for EXEC_QUANTITY; fall back to top-of-book when depth is thin
      // (otherwise both sides null and no pair ever qualifies).
      // const rawBuyPx = buyEx.buy ?? buyEx.bestAsk;
      // const rawSellPx = sellEx.sell ?? sellEx.bestBid;
      // if (rawBuyPx === null || rawSellPx === null) continue;

      const quantity = clampExecQty(buyEx.asks, sellEx.bids, EXEC_QUANTITY_MAX);
      if (quantity < EXEC_QUANTITY_MIN) continue;

      const buyVWAP = Calc.avgExecPrice(buyEx.asks, quantity);
      const sellVWAP = Calc.avgExecPrice(sellEx.bids, quantity);
      if (!buyVWAP || !sellVWAP) continue;

      const buyFee = fees[buyEx.exchange]?.taker ?? 0;
      const sellFee = fees[sellEx.exchange]?.taker ?? 0;

      const effectiveBuyPrice = buyVWAP.toNumber() * (1 + buyFee);
      const effectiveSellPrice = sellVWAP.toNumber() * (1 - sellFee);

      const profitPerUnit = effectiveSellPrice - effectiveBuyPrice;
      const grossProfit = new Decimal(quantity).mul(profitPerUnit).toNumber();

      if (!best || grossProfit > best.grossProfit) {
        best = {
          buyEx,
          sellEx,
          buyFrom: buyEx.exchange,
          sellTo: sellEx.exchange,
          quantity,
          profitPerUnit,
          grossProfit,
          effectiveBuyPrice: new Decimal(effectiveBuyPrice).toNumber(),
          effectiveSellPrice: new Decimal(effectiveSellPrice).toNumber(),
        };
      }
    }
  }

  if (!best || best.grossProfit <= 0) return null;
  return best;
};

export default calculateArbitrage;
