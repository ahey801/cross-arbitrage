# cross-arbitrage

Node.js service that subscribes to **Nobitex** and **BitPin** USDT/IRT order books over **Centrifuge** WebSockets, normalizes levels, stores per-venue quotes, and evaluates simple **cross-venue arbitrage** (buy on one exchange, sell on the other). A minimal **Express** server runs alongside the feeds.

This is experimental tooling, not trading or investment advice. Exchange APIs, channels, and fee schedules can change without notice.

## Requirements

- **Node.js** 18+ recommended (uses native ES modules and `tsx` for development).
- Network access to the configured WebSocket endpoints.

## Install

```bash
npm install
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Run `src/index.ts` with `tsx` (watch mode). |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run compiled app (`node dist/index.js`). |

## Configuration (`.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port for Express (default `4000` if unset). |
| `NOBITEX_API_URL` | Nobitex Centrifuge WebSocket URL. |
| `BITPIN_API_URL` | BitPin Centrifuge WebSocket URL. |
| `EXEC_QUANTITY` | Notional **USDT** size used for VWAP “buy” / “sell” quotes in the market store (default `1000`). |
| `NOBITEX_CONVERT_RIAL_TO_TOMAN` | If `true`, multiply Nobitex quoted prices by `0.1` (Rial → Toman) in the adapter before downstream logic. |
| `BITPIN_CONVERT_RIAL_TO_TOMAN` | Same for BitPin (usually `false` if quotes are already aligned with Nobitex). |

Copy `.env` and adjust values for your environment. **Rial vs Toman** must match across venues or arbitrage math will be meaningless; use the convert flags only if you know each feed’s convention.

## How it works

1. **Adapters** (`src/adapters/`) — `NobitexWS` and `BitPinWS` connect with [`centrifuge`](https://github.com/centrifugal/centrifuge-js) and the [`ws`](https://github.com/websockets/ws) package (required in Node per Centrifuge docs). Optional **price scaling** (Rial→Toman) runs on raw `bids` / `asks` before emit.
2. **Event bus** (`src/events/eventBus.ts`) — Adapters emit `orderbook:update` with `{ exchange, bids, asks, timestamp }`.
3. **Market store** (`src/market/marketStore.ts`) — Builds an `Orderbook`, computes VWAP buy/sell for `EXEC_QUANTITY` via `Calc`, and stores **best bid / best ask** for thin-book fallbacks.
4. **Arbitrage** (`src/engine/arbitrage.ts`) — For each ordered pair of venues, uses VWAP prices when available, otherwise **top-of-book** bid/ask, applies per-venue **taker fees** from `fees`, and keeps the best **positive** edge (`sell` leg minus `buy` leg). Results are logged from `src/index.ts` when non-null.

Channels are currently wired as:

- Nobitex: `public:orderbook-USDTIRT`
- BitPin: `orderbook:USDT_IRT`

Change these in `src/index.ts` if your market or channel names differ.

## Execution price math (`Calc.avgExecPrice`)

The calculator implements a **discrete level-by-level fill** and returns the **volume-weighted average execution price (VWAP)** for a target base size \(Q\) (in this project, `EXEC_QUANTITY`, e.g. USDT). Implementation: `src/engine/calc.ts` (uses `decimal.js` for arithmetic).

### Book notation

- Order book side is a sequence of levels \(i = 1,\ldots,n\).
- Level \(i\) has **price** \(p_i > 0\) (quote currency **per 1 unit** of base, e.g. IRT per USDT) and **amount** \(a_i > 0\) (base size available at that price).
- Levels are consumed in **walk order**: for **asks** (buying base), cheapest ask first; for **selling base**, best bid first (handled by sorting in `Orderbook`).

### Fill recursion

Let \(Q > 0\) be the size to fill. Define **remaining** base after the first \(i-1\) levels:

\[
r_0 = Q,\qquad
t_i = \min(r_{i-1},\, a_i),\qquad
r_i = r_{i-1} - t_i.
\]

Here \(t_i\) is how much base you actually take from level \(i\). The **quote** contributed by that tranche (cost when buying from asks, proceeds when selling into bids) is:

\[
c_i = t_i \, p_i.
\]

Stop early if \(r_i = 0\) (full size filled).

### Liquidity check

If, after all levels, \(r_n > 0\), the book cannot supply \(Q\) base at any combination of posted sizes — the function returns **`null`** (“not enough liquidity”).

### VWAP formula

If the book fills the order (\(r_n = 0\) after the last touched level), total quote is \(C = \sum_i c_i\) over levels with \(t_i > 0\). The **average execution price per unit of base** is:

\[
P_{\mathrm{vwap}} \;=\; \frac{C}{Q} \;=\; \frac{1}{Q}\sum_{i=1}^{n} t_i\, p_i
\;=\; \sum_{i=1}^{n} \frac{t_i}{Q}\, p_i.
\]

So \(P_{\mathrm{vwap}}\) is a **weighted average** of the prices \(p_i\) you touch, with weights \(t_i/Q\) (non-negative and summing to 1 over touched levels).

### Use in this repo

- **`buy`** (market store): VWAP over **asks** for size \(Q\) → average price **paid per USDT** when buying \(Q\) USDT.
- **`sell`**: VWAP over **bids** for size \(Q\) → average price **received per USDT** when selling \(Q\) USDT.

Arbitrage and fallbacks (`bestAsk` / `bestBid`) use these values or top-of-book when VWAP is unavailable; see `src/market/marketStore.ts` and `src/engine/arbitrage.ts`.

## Project layout

```
src/
  adapters/          # Centrifuge clients + optional quote scaling
  engine/            # VWAP calc + arbitrage
  events/            # Shared EventEmitter bus
  market/            # In-memory map of venue state
  orderbook/         # Normalize & sort levels
  index.ts           # Wiring: HTTP + feeds + bus handler
```

## HTTP

`GET /` returns a short health string. The real-time logic does not depend on HTTP beyond having the process running.

## Troubleshooting

- **No arbitrage logs** — Real markets often have no crossed edge after fees; VWAP may be `null` if `EXEC_QUANTITY` is larger than visible depth (the engine then falls back to best bid/ask). Mis-matched **IRT units** (Rial vs Toman) also makes edges look wrong; fix convert flags first.
- **WebSocket issues in Node** — This repo passes `websocket: WebSocket` from `ws` into Centrifuge (`src/adapters/centrifugeWebSocket.ts`). If you remove `ws`, reconnect behavior may break depending on Node version.
- **Nobitex delta** — Nobitex subscription uses Centrifuge `{ delta: "fossil" }`; the client reconstructs full payloads before your handler runs.

## License

ISC (see `package.json`).
