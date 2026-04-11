import WebSocket from "ws";

/** Centrifuge-js requires an explicit WebSocket in Node (see centrifuge README). */
export const centrifugeNodeOptions = {
  websocket: WebSocket,
} as const;
