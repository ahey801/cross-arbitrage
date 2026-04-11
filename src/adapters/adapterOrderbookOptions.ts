export type OrderbookAdapterOptions = {
  /**
   * Multiply each level's quote price (e.g. `0.1` for Rial → Toman).
   */
  priceScale?: number;
  /** Shorthand: multiply prices by `0.1` (divide Rial by 10 → Toman). */
  convertRialToToman?: boolean;
};

export function resolveOrderbookPriceScale(
  opts?: OrderbookAdapterOptions,
): number {
  if (opts?.convertRialToToman) {
    return 0.1;
  }
  const s = opts?.priceScale;
  if (s != null && Number.isFinite(s) && s > 0) {
    return s;
  }
  return 1;
}

export function scaleOrderbookSides(
  bids: unknown[] | undefined,
  asks: unknown[] | undefined,
  priceScale: number,
): { bids: unknown[]; asks: unknown[] } {
  if (priceScale === 1) {
    return { bids: bids ?? [], asks: asks ?? [] };
  }

  const scaleLevel = (level: unknown): unknown => {
    if (Array.isArray(level) && level.length >= 2) {
      const p = Number(level[0]);
      const q = Number(level[1]);
      return [p * priceScale, q];
    }
    if (level && typeof level === "object") {
      const o = { ...(level as Record<string, unknown>) };
      if ("price" in o && o.price != null && o.price !== "") {
        o.price = Number(o.price) * priceScale;
      }
      if ("p" in o && o.p != null && o.p !== "") {
        o.p = Number(o.p) * priceScale;
      }
      return o;
    }
    return level;
  };

  return {
    bids: (bids ?? []).map(scaleLevel),
    asks: (asks ?? []).map(scaleLevel),
  };
}
