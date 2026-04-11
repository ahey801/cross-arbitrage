import { Centrifuge } from "centrifuge";

import eventBus from "../events/eventBus.js";

import {
  type OrderbookAdapterOptions,
  resolveOrderbookPriceScale,
  scaleOrderbookSides,
} from "./adapterOrderbookOptions.js";
import { centrifugeNodeOptions } from "./centrifugeWebSocket.js";

const BITPIN_API_URL =
  process.env.BITPIN_API_URL ||
  "wss://centrifugo.bitpin.ir/connection/websocket";

class BitPinWS {
  private client: Centrifuge;
  private readonly priceScale: number;

  constructor(opts?: OrderbookAdapterOptions) {
    this.client = new Centrifuge(BITPIN_API_URL, centrifugeNodeOptions);
    this.priceScale = resolveOrderbookPriceScale(opts);
  }

  public connect(): void {
    this.client.on("connected", (ctx) => {
      console.log("BitPin connected", ctx);
    });
    this.client.on("error", (ctx) => {
      console.log("BitPin Centrifuge error", ctx.error);
    });
    this.client.on("disconnected", (ctx) => {
      console.log("BitPin disconnected", ctx.code, ctx.reason);
    });

    this.client.connect();
  }

  public subscribe(channel: string): void {
    const sub = this.client.newSubscription(channel);

    sub.on("subscribed", (ctx) => {
      console.log("BitPin subscribed", ctx);
    });

    sub.on("publication", (ctx) => {
      const data = ctx.data as { bids?: unknown[]; asks?: unknown[] };
      const { bids, asks } = scaleOrderbookSides(
        data.bids,
        data.asks,
        this.priceScale,
      );

      eventBus.emit("orderbook:update", {
        exchange: "bitpin",
        asks,
        bids,
        timestamp: Date.now(),
      });
    });

    sub.subscribe();
  }
}

export default BitPinWS;
