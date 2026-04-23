import express from "express";
import dotenv from "dotenv";
dotenv.config();

import NobitexWS from "./adapters/nobitex.ws.js";
import BitPinWS from "./adapters/bitpin.ws.js";
import TabdealWS from "./adapters/tabdeal.ws.js";

import eventBus from "./events/eventBus.js";

// Market
import { getMarketMap, updateMap } from "./market/marketStore.js";

// Engine
import calculateArbitrage from "./engine/arbitrage.js";

const app = express();

eventBus.on("orderbook:update", ({ exchange, bids, asks }) => {
  updateMap(exchange, bids, asks);
  const marketMap = getMarketMap();
  const arbitrage = calculateArbitrage(marketMap);
  if (arbitrage) console.log(arbitrage);
});

const nobitex = new NobitexWS(
  process.env.NOBITEX_CONVERT_RIAL_TO_TOMAN === "true"
    ? { convertRialToToman: true }
    : undefined,
);
nobitex.connect();
nobitex.subscribe("public:orderbook-USDTIRT");

const bitpin = new BitPinWS(
  process.env.BITPIN_CONVERT_RIAL_TO_TOMAN === "true"
    ? { convertRialToToman: true }
    : undefined,
);
bitpin.connect();
bitpin.subscribe("orderbook:USDT_IRT");

const tabdeal = new TabdealWS(
  process.env.TABDEAL_CONVERT_RIAL_TO_TOMAN === "true"
    ? { convertRialToToman: true }
    : undefined,
);
tabdeal.connect();
tabdeal.subscribe("usdtirt@depth@2000ms");

const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API running with Express + TypeScript");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
