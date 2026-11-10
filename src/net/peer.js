// Verbindung über PeerJS (WebRTC). Der öffentliche PeerJS-Server vermittelt nur, danach reden die Browser direkt.
import { Peer } from "peerjs";
import { makeCode, peerIdFor } from "./protocol.js";

const JOIN_TIMEOUT_MS = 15000;
const MAX_CODE_TRIES = 5;

function describe(error) {
  switch (error?.type) {
    case "peer-unavailable":
      return "Raum nicht gefunden. Stimmt der Code?";
    case "browser-incompatible":
      return "Dieser Browser unterstützt kein WebRTC.";
    case "network":
    case "server-error":
    case "socket-error":
    case "socket-closed":
      return "Der Vermittlungsserver ist nicht erreichbar. Bitte später nochmal versuchen.";
    default:
      return `Verbindungsfehler (${error?.type ?? "unbekannt"}).`;
  }
}

function wrap(connection) {
  const messageHandlers = [];
  const closeHandlers = [];
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    for (const handler of closeHandlers) handler();
  };
  connection.on("data", (data) => {
    for (const handler of messageHandlers) handler(data);
  });
  connection.on("close", finish);
  connection.on("error", finish);
  return {
    send(msg) {
      if (connection.open) connection.send(msg);
    },
    onMessage: (handler) => messageHandlers.push(handler),
    onClose: (handler) => closeHandlers.push(handler),
    close() {
      connection.close();
      finish();
    },
  };
}

export function openRoom({ onCode, onGuest, onError }) {
  let peer = null;
  let tries = 0;
  let destroyed = false;

  function attempt() {
    const code = makeCode();
    peer = new Peer(peerIdFor(code));
    peer.on("open", () => onCode(code));
    peer.on("connection", (connection) => connection.on("open", () => onGuest(wrap(connection))));
    // Bricht nur die Leitung zum Vermittlungsserver ab, laufen bestehende Verbindungen weiter.
    peer.on("disconnected", () => {
      if (!destroyed) peer.reconnect();
    });
    peer.on("error", (error) => {
      if (error.type === "unavailable-id" && tries < MAX_CODE_TRIES) {
        tries += 1;
        peer.destroy();
        attempt();
      } else if (error.type !== "peer-unavailable") {
        onError(describe(error));
      }
    });
  }

  attempt();
  return {
    close() {
      destroyed = true;
      peer?.destroy();
    },
  };
}

export function joinRoom(code, { onOpen, onError }) {
  const peer = new Peer();
  let settled = false;
  const fail = (text) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    peer.destroy();
    onError(text);
  };
  const timer = setTimeout(() => fail("Keine Verbindung zum Raum. Stimmt der Code, und ist der Host noch da?"), JOIN_TIMEOUT_MS);

  peer.on("open", () => {
    const connection = peer.connect(peerIdFor(code), { reliable: true, serialization: "json" });
    connection.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      onOpen(wrap(connection));
    });
  });
  peer.on("error", (error) => fail(describe(error)));

  return {
    close() {
      settled = true;
      clearTimeout(timer);
      peer.destroy();
    },
  };
}
