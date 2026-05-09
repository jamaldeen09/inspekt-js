import { WebSocket } from "ws";

export function decode(data: any) {
  const parsed = JSON.parse(data.toString());
  return parsed;
}


export function encode(data: Object) {
  const stringifiedJson = JSON.stringify(data);
  return Buffer.from(stringifiedJson)
};


export function isWsConnected(ws: WebSocket) {
  return ws.readyState === ws.OPEN;
}

export function emit(ws: WebSocket, data: string | Object) {
  const finalData = typeof data === "string" ? data : encode(data);

  const isConnected = isWsConnected(ws);
  if (isConnected)
    ws.send(finalData);
}