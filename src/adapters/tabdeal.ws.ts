import eventBus from "../events/eventBus.js";
import {
  OrderbookAdapterOptions,
  resolveOrderbookPriceScale,
  scaleOrderbookSides,
} from "./adapterOrderbookOptions.js";
import WebSocket from "ws";

const TABDEAL_API_URL =
  process.env.TABDEAL_API_URL || "wss://api1.tabdeal.org/stream/";

class TabdealWS {
  private client: WebSocket | null = null;
  private readonly priceScale: number;
  private readonly subscribedChannels = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(opts?: OrderbookAdapterOptions) {
    this.priceScale = resolveOrderbookPriceScale(opts);
  }

  public connect(): void {
    if (
      this.client &&
      (this.client.readyState === WebSocket.OPEN ||
        this.client.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isShuttingDown = false;
    this.client = new WebSocket(TABDEAL_API_URL);

    this.client.on("open", () => {
      console.log("Tabdeal WebSocket connected");
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.resubscribeAll();
    });
    this.client.on("message", (message) => {
      this.handleMessage(message);
    });
    this.client.on("error", (error) => {
      console.log("Tabdeal WebSocket error", error);
    });
    this.client.on("close", () => {
      console.log("Tabdeal WebSocket closed");
      this.client = null;
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });
  }

  public subscribe(channel: string): void {
    this.subscribedChannels.add(channel);
    if (!this.client) {
      this.connect();
    }
    this.sendSubscription(channel);
  }

  public unsubscribe(channel: string): void {
    this.subscribedChannels.delete(channel);
    if (!this.client) return;
    this.safeSend({
      method: "UNSUBSCRIBE",
      params: [channel],
      id: 2,
    });
  }

  private handleMessage(message: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.toString());
    } catch {
      return;
    }

    const data = this.extractOrderbookPayload(parsed);
    if (!data) return;

    const { bids, asks } = scaleOrderbookSides(
      data.bids,
      data.asks,
      this.priceScale,
    );

    eventBus.emit("orderbook:update", {
      exchange: "tabdeal",
      asks,
      bids,
      timestamp: Date.now(),
    });
  }

  private sendSubscription(channel: string): void {
    this.safeSend({
      method: "SUBSCRIBE",
      params: [channel],
      id: 1,
    });
  }

  private safeSend(payload: object): void {
    if (!this.client) return;
    const textPayload = JSON.stringify(payload);

    if (this.client.readyState === WebSocket.OPEN) {
      this.client.send(textPayload);
      return;
    }

    if (this.client.readyState === WebSocket.CONNECTING) {
      this.client.once("open", () => {
        if (this.client?.readyState === WebSocket.OPEN) {
          this.client.send(textPayload);
        }
      });
    }
  }

  private resubscribeAll(): void {
    for (const channel of this.subscribedChannels) {
      this.sendSubscription(channel);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;
    console.log(`Tabdeal reconnecting in ${delayMs}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private extractOrderbookPayload(
    message: unknown,
  ): { bids?: unknown[]; asks?: unknown[] } | null {
    if (!message || typeof message !== "object") return null;

    const root = message as Record<string, unknown>;
    const payload =
      root.data && typeof root.data === "object"
        ? (root.data as Record<string, unknown>)
        : root;

    const bids = Array.isArray(payload.bids)
      ? payload.bids
      : Array.isArray(payload.b)
        ? payload.b
        : undefined;
    const asks = Array.isArray(payload.asks)
      ? payload.asks
      : Array.isArray(payload.a)
        ? payload.a
        : undefined;

    if (!bids || !asks) return null;
    return { bids, asks };
  }
}

export default TabdealWS;
