export type Level = {
  price: number;
  amount: number;
};

class Orderbook {
  public bids: Level[] = [];
  public asks: Level[] = [];

  constructor(bids: any[] = [], asks: any[] = []) {
    const bidLevels = this.normalize(bids);
    const askLevels = this.normalize(asks);
    bidLevels.sort((a, b) => b.price - a.price);
    askLevels.sort((a, b) => a.price - b.price);
    this.bids = bidLevels;
    this.asks = askLevels;
  }

  private normalize(levels: any[]): Level[] {
    return levels
      .map((level) => {
        if (Array.isArray(level)) {
          return {
            price: Number(level[0]),
            amount: Number(level[1]),
          };
        }

        const price = level.price ?? level.p;
        const amount = level.amount ?? level.qty ?? level.q;

        return {
          price: Number(price),
          amount: Number(amount),
        };
      })
      .filter((lvl) => {
        return (
          !Number.isNaN(lvl.price) &&
          !Number.isNaN(lvl.amount) &&
          lvl.amount > 0
        );
      });
  }
}

export default Orderbook;
