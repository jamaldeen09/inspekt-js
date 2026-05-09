import { WebSocket } from "ws"
import { decode, emit } from "./lib/socket-utils.js";
import { AnalysisResult, ConnectionConfig, JsonSocketMessage } from "./types.js";
import { scrub, truncateData } from "./lib/general-utils.js";

export interface InspektOptions {
    /** The project API Key from your Inspekt Dashboard */
    apiKey: string;

    /**
     * Toggles the visual AI analysis cards in the terminal.
     * * When true (default), Inspekt will print a structured, color-coded 
     * diagnosis to the console. Set to false in environments where 
     * you want silent monitoring or are piping logs to a third-party 
     * logging service.
     * * @default true
     */
    terminalOutput?: boolean;

    /** * Determines which responses trigger an AI analysis.
     * 'errors' (default): Only 4xx and 5xx.
     * 'always': Every single request (EXPENSIVE).
     * 'never': Turn off analysis but keep logging.
     */
    analysisMode?: 'errors' | 'always' | 'never';

    /** List of sensitive keys to redact from headers and body before sending to AI */
    redactKeys?: string[];
};

class Inspekt {
    private apiKey: string;
    private options: Required<Omit<InspektOptions, 'apiKey'>>;
    private connectionConfig: ConnectionConfig = {
        ws: null,
        reconnectionAttempts: 0,
        maxDelay: 30000
    };

    // ---- Constructor ------------------
    constructor(options: InspektOptions) {
        this.apiKey = this.validateApiKey(options.apiKey);

        // Set smart defaults so the user doesn't have to provide everything
        this.options = {
            analysisMode: options.analysisMode ?? 'errors',
            redactKeys: ["authorization", "cookie", "set-cookie", ...(options.redactKeys ?? [])],
            terminalOutput: options.terminalOutput ?? true
        };
    };

    /**
     * Orchestrates a reconnection attempt using an exponential backoff strategy.
     * Calculates delay based on the number of failed attempts, capped by a max delay,
     * to prevent overwhelming the server during outages.
     */
    private retryConnection() {
        // Introduce Jitter: delay * (0.8 to 1.2)
        const jitter = Math.random() * 0.4 + 0.8;
        const baseDelay = Math.min(Math.pow(2, this.connectionConfig.reconnectionAttempts) * 1000, this.connectionConfig.maxDelay);
        const finalDelay = baseDelay * jitter;
        console.log(`[Inspekt] Reconnecting in ${Math.round(finalDelay / 1000)}s...`);

        setTimeout(() => {
            this.connectionConfig.reconnectionAttempts++;
            this.connect();
        }, finalDelay);
    };

    /**
      * Establishes a persistent, full-duplex WebSocket connection to the Inspekt server.
      * 
      * @description
      * This method initializes the real-time bridge, synchronizing client configuration 
      * (API keys, redaction rules, and analysis modes) during the handshake. It manages 
      * the entire connection lifecycle, including proactive health checks (Ping/Pong), 
      * real-time event routing for AI analysis results, and intelligent reconnection 
      * logic that distinguishes between transient network drops and terminal auth failures.
      * 
      * @listens WebSocket#onopen - Resets retry counters and initiates the heartbeat cycle.
      * @listens WebSocket#onmessage - Decodes and routes analysis results or heartbeats.
      * @listens WebSocket#onclose - Evaluates error codes to determine if a retry is warranted.
      * @listens WebSocket#onerror - Captures and logs transport-level interruptions.
    */
    public connect() {
        const initialUrl = `wss://inspekt-engine-production.up.railway.app`;
        const wsUrl = new URL(initialUrl);
        const searchParams = wsUrl.searchParams;

        // Set the search params
        searchParams.set("type", "sdk");
        searchParams.set("apiKey", this.apiKey);
        searchParams.set("redactKeys", JSON.stringify(this.options.redactKeys));
        searchParams.set("analysisMode", this.options.analysisMode);

        // Create a ws connection
        const ws = new WebSocket(wsUrl.toString());
        this.connectionConfig.ws = ws; 

        // Open Event
        ws.onopen = () => {
            // Reset any previous reconnection attempts
            this.connectionConfig.reconnectionAttempts = 0;

            // Emit a ping message to the socket server
            // as soon as the socket connection opens
            ws.send("ping");
        };

        // Close Event
        ws.onclose = (event) => {
            const codes = [1008, 1011, 4002, 4003];
            const reason = event.reason || "Underlying network interruption or handshake timeout";

            // Don't attempt to reconnect on specific codes
            if (codes.some((code) => code === event.code)) {
                console.log(`[Inspekt] Connection closed. Code: ${event.code} - Reason: ${reason}`);
                return;
            };

            // Retry the connection
            this.retryConnection();
        };

        // Message Event
        ws.onmessage = (event) => {
            const message = typeof event.data === "string" ? event.data : decode(event.data);

            // Handle pong messages
            if (message === "pong") {
                setTimeout(() => {
                    emit(ws, "ping");
                }, 20000);
                return;
            };

            if (message === "connected") {
                console.log("[Inspekt] Connection established");
                return;
            }

            // Handle valid json messages
            const isValidJsonMsg = "event" in message &&
                (["analysis:success", "no:analysis", "analysis:error"].some((event) => message.event === event))
                && "data" in message;

            if (!isValidJsonMsg) return;

            const typed = message as JsonSocketMessage;
            const data = typed.data as AnalysisResult;
            switch (typed.event) {
                case "analysis:success":
                    // Only log if the user explicitly says so
                    if (this.options.terminalOutput)
                        this.logAnalysis(data.analysis, data.metadata);
                    break;

                case "no:analysis":
                    console.log(`[Inspekt] ${data.msg}`);
                    break;

                case "analysis:error":
                    const code = data?.error?.code;
                    if (code === "DIAGNOSES_SYNC_ERROR") {
                        const bgRed = '\x1b[41m';
                        const white = '\x1b[37m';
                        const bold = '\x1b[1m';
                        const reset = '\x1b[0m';

                        // High-impact banner
                        console.log(`\n${bgRed}${white}${bold}  INSPEKT ERROR  ${reset}`);
                        console.log(`${bold}CREDIT SYNC FAILED:${reset} ${data.msg}`);
                    } else {
                        console.log(`[Inspekt] Analysis failed. Message: ${data.msg}`);
                    };

                    break;
            }
        };

        // Error Event
        ws.onerror = (event) => {
            const errorMsg = event.message || (event.error && event.error.message) || "Unknown network or handshake error";

            if (this.connectionConfig.reconnectionAttempts <= 1) {
                console.error(`[Inspekt] Connection error: ${errorMsg || "Server Unreachable"}`);
            }

            if (ws.readyState === ws.CLOSED) {
                this.retryConnection();
            }
        }
    };

    /**
     * Validates api keys to follow inspekt's official  
     * api key format and to make sure it exists 
     * @param key 
     * @private
     */
    private validateApiKey(key: string): string {
        const keyLength = 57;

        // Basic check: Does the key exist?
        if (!key || key?.trim() === "") {
            throw new Error("[Inspekt] API Key is missing. Get one at https://inspekt.app");
        };

        // Format check: Does it start with the custom prefix?
        const prefix = "ins_live_";
        if (!key.startsWith(prefix)) {
            throw new Error(`[Inspekt] Invalid API Key format. Keys should start with "${prefix}"`);
        }

        // Length check: key's length must be exactly 57;
        if (key.length !== keyLength) {
            const detail = key.length < keyLength ? "short" : "long";
            throw new Error(`[Inspekt] API Key seems too ${detail}. Please check your dashboard`)
        }

        return key;
    };

    /**
     * Renders the AI analysis results to the system console.
     * * This method handles the visual construction of the "Inspekt Card,"
     * including ANSI color-coding for severity levels (OK, WARNING, CRITICAL),
     * and structured sections for Diagnosis, Issues, Security, and Fixes.
     * @param analysis - The structured JSON object returned from the Inspekt AI engine.
     * @param req - The incoming Express request object used to extract the method, path, and timestamp.
     * @private
     */
    private logAnalysis(analysis: any, metadata: any) {

        // Card design
        const severity: string = analysis.severity?.toUpperCase();
        const severityColor: string = {
            'OK': '\x1b[32m',    // green
            'WARNING': '\x1b[33m',   // yellow
            'CRITICAL': '\x1b[31m',  // red
        }[severity] ?? '\x1b[37m'
        const reset = '\x1b[0m';
        const dim = '\x1b[2m';
        const bold = '\x1b[1m';
        const cyan = '\x1b[36m';
        const inverse = '\x1b[7m';
        const path = metadata?.path || "/";
        const method = metadata?.method || "Unknown"

        // Timestamp
        const serverTime = analysis.timestamp ? new Date(analysis.timestamp) : new Date();
        const hours = serverTime.getHours() % 12 || 12;
        const minutes = serverTime.getMinutes().toString().padStart(2, '0');
        const seconds = serverTime.getSeconds().toString().padStart(2, '0');
        const ampm = serverTime.getHours() >= 12 ? 'PM' : 'AM';
        const niceTime = `${hours}:${minutes}:${seconds} ${ampm}`;

        console.log(`\n${inverse}${bold} ${method} ${path} ${reset} ${dim}${niceTime}${reset}`);
        console.log(`\n${bold}${cyan}INSPEKT${reset} ${dim}─────────────────────────────────────────${reset} ${severityColor}${bold}${severity}${reset}`);

        // Summary + Status
        console.log(`\n${bold}${analysis.summary}${reset}`);
        console.log(`${dim}${analysis.status.code} · ${analysis.status.meaning}${reset}`);

        // Diagnosis
        console.log(`\n${bold}Diagnosis${reset}`);
        console.log(`  ${analysis.diagnosis}`);

        // Issues
        if (analysis?.issues && Array.isArray(analysis.issues) && analysis.issues?.length > 0) {
            console.log(`\n${bold}Issues${reset}`);
            analysis.issues.forEach((i: string) => console.log(`  \x1b[33m·\x1b[0m ${i}`));
        }

        // Security & Headers
        if (analysis.headers?.security_flags?.length > 0 || analysis.headers?.missing?.length > 0) {
            console.log(`\n${bold}Security & Headers${reset}`);
            analysis.headers.security_flags?.forEach((f: string) => console.log(`  \x1b[31m· FLAG\x1b[0m ${f}`));
            analysis.headers.missing?.forEach((m: string) => console.log(`  \x1b[33m· MISSING\x1b[0m ${m}`));
        }

        // Body & Performance
        if (analysis.body?.anomalies?.length > 0 || analysis.performance_flags?.length > 0) {
            console.log(`\n${bold}Performance & Body${reset}`);
            analysis.body?.anomalies?.forEach((a: string) => console.log(`  \x1b[36m· BODY\x1b[0m ${a}`));
            analysis.performance_flags?.forEach((p: string) => console.log(`  \x1b[36m· PERF\x1b[0m ${p}`));
        }

        // Fixes
        if (analysis?.fixes && Array.isArray(analysis.fixes) && analysis.fixes.length > 0) {
            console.log(`\n${bold}Fixes${reset}`);
            analysis.fixes.forEach((f: string) => console.log(`  \x1b[32m·\x1b[0m ${f}`));
        }

        console.log(`\n${dim}─────────────────────────────────────────────────────${reset}\n`);
    }

    /**
     * processes the captured response in the background.
     * handles the logic for parsing the ai response and triggering the console logs.
     * @param req - the original express request object
     * @param res - the express response object
     * @param body - the intercepted response body
     * @private
     */

    private extractData(args: {
        req: any,
        res: any,
        responseBody: any,
        responseHeaders: any,
        status?: number,
    }) {
        // Build the url
        const { req, res, responseBody, responseHeaders, status } = args
        const host = req?.headers?.host || req?.get?.('host') || 'localhost';
        const protocol = (req as any).protocol || 'http';
        const path = req?.originalUrl || req?.url || '/';
        const url = `${protocol}://${host}${path}`;


        // Sanitize the data
        const { redactKeys } = this.options;
        const requestHeaders = req?.headers ? scrub(req?.headers, redactKeys) : null;
        const resHeaders = responseHeaders ? scrub(responseHeaders, redactKeys) : null;
        const requestBody = req?.body ? scrub(truncateData(req?.body), redactKeys) : null;
        const resBody = responseBody ? scrub(truncateData(responseBody), redactKeys) : null;

        return {
            url,  
            method: req?.method,
            status: status || res?.statusCode,
            requestHeaders,
            responseHeaders: resHeaders,
            requestBody,
            responseBody: resBody,
        }
    };

    /**
     * Intercepts and filters API traffic based on the configured analysis mode.
     * If the criteria are met, it extracts relevant request/response data and 
     * emits a 'new:analysis' event to the socket server.
     */
    public newAnalysis(args: {
        req: any,
        res: any,
        responseBody: any,
        responseHeaders: any,
        responseTime: number,
        status?: number,
    }) {      
        const { ws } = this.connectionConfig;
        if (!ws) return;

        const { req, res, responseBody, responseTime, responseHeaders, status } = args;
        const data = this.extractData({ req, res, responseBody, responseHeaders, status });
        const path = req.originalUrl || req.url || '/';
        const method = req.method;

        return emit(ws, {
            event: "new:analysis",  
            data: {
                ...data,
                responseTime,
                metadata: { method, path } 
            }
        });
    };
}

export default Inspekt