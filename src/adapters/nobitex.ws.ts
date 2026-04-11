import { Centrifuge } from "centrifuge";

import eventBus from "../events/eventBus.js";

import {
  type OrderbookAdapterOptions,
  resolveOrderbookPriceScale,
  scaleOrderbookSides,
} from "./adapterOrderbookOptions.js";
import { centrifugeNodeOptions } from "./centrifugeWebSocket.js";

const NOBITEX_API_URL =
  process.env.NOBITEX_API_URL || "wss://ws.nobitex.ir/connection/websocket";

class NobitexWS {
  private client: Centrifuge;
  private readonly priceScale: number;

  constructor(opts?: OrderbookAdapterOptions) {
    this.client = new Centrifuge(NOBITEX_API_URL, centrifugeNodeOptions);
    this.priceScale = resolveOrderbookPriceScale(opts);
  }

  public connect(): void {
    this.client.on("connected", (ctx) => {
      console.log("Nobitex connected", ctx);
    });
    this.client.on("error", (ctx) => {
      console.log("Nobitex Centrifuge error", ctx.error);
    });
    this.client.on("disconnected", (ctx) => {
      console.log("Nobitex disconnected", ctx.code, ctx.reason);
    });

    this.client.connect();
  }

  public subscribe(channel: string): void {
    const sub = this.client.newSubscription(channel, { delta: "fossil" });

    sub.on("subscribed", (ctx) => {
      console.log("Nobitex subscribed", ctx);
    });

    sub.on("publication", (ctx) => {
      const data = ctx.data as { bids?: unknown[]; asks?: unknown[] };
      const { bids, asks } = scaleOrderbookSides(
        data.bids,
        data.asks,
        this.priceScale,
      );

      eventBus.emit("orderbook:update", {
        exchange: "nobitex",
        asks,
        bids,
        timestamp: Date.now(),
      });
    });

    sub.subscribe();
  }
}

export default NobitexWS;
