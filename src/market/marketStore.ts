// Orderbook
import Orderbook, { Level } from "../orderbook/orderbook.js";

// Engine
// import Calc from "../engine/calc.js";

export interface ExchangeState {
  exchange: string;
  /** VWAP to buy `EXEC_QUANTITY` from asks; null if book cannot fill. */
  // bid: number | null;
  /** VWAP to sell `EXEC_QUANTITY` into bids; null if book cannot fill. */
  // sell: number | null;
  bids: Level[];
  asks: Level[];
  bestAsk: number;
  bestBid: number;
  timestamp: number;
}

const market = new Map<string, ExchangeState>();

export const updateMap = (exchange: string, bids: any[], asks: any[]) => {
  const ob = new Orderbook(bids ?? [], asks ?? []);

  // const buyPrice = Calc.avgExecPrice(ob.asks, EXEC_QUANTITY);
  // const sellPrice = Calc.avgExecPrice(ob.bids, EXEC_QUANTITY);

  const bestAsk = ob.asks[0]?.price ?? null;
  const bestBid = ob.bids[0]?.price ?? null;

  market.set(exchange, {
    exchange,
    // buy: buyPrice === null ? null : buyPrice.toNumber(),
    // sell: sellPrice === null ? null : sellPrice.toNumber(),
    bids: ob.bids,
    asks: ob.asks,
    bestAsk,
    bestBid,
    timestamp: Date.now(),
  });
};

export const getMarketMap = () => Array.from(market.values());
