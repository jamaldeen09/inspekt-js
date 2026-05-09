import { WebSocket } from "ws";

export interface ConnectionConfig {
    ws: WebSocket | null;
    reconnectionAttempts: number;
    maxDelay: number;
}

export type ValidEvent = "analysis:success" | "no:analysis" | "analysis:error"
export interface JsonSocketMessage {
    event: ValidEvent;
    data: unknown;
}

export interface AnalysisResult {
    analysis: any | null;
    msg: string;
    metadata?: any;
    error?: any;
}
