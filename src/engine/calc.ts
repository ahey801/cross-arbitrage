import { Decimal } from "decimal.js";

// types
import type { Level } from "../orderbook/orderbook.js";

class Calc {
  // Bucket Algorithm
  static avgExecPrice(asks: Level[], quantity: number) {
    let remaining = new Decimal(quantity);
    let totalPrice = new Decimal(0);

    for (const ask of asks) {
      const price = new Decimal(ask.price);
      const amount = new Decimal(ask.amount);

      const take = Decimal.min(remaining, amount);

      totalPrice = totalPrice.plus(take.mul(price));
      remaining = remaining.minus(take);

      if (remaining.eq(0)) break;
    }

    if (!remaining.eq(0)) return null; // Not enough liquidity

    return totalPrice.div(quantity);
  }
}

export default Calc;
