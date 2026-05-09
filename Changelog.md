# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-03-28

### 🚀 Added
- **Core Engine**: Initial release of the Inspekt SDK for Node.js.
- **AI-Powered Diagnostics**: Real-time terminal output for API errors (4xx/5xx) and performance bottlenecks.
- **Express Adapter**: Drop-in middleware for Express.js applications.
- **NestJS Adapter**: Global Interceptor support for NestJS with RxJS integration.
- **Fastify Adapter**: Native plugin support for Fastify using the `onResponse` hook.
- **Sensitive Data Redaction**: Automatic masking of `authorization` and custom keys to ensure PII never leaves the server.
- **Flexible Analysis Modes**: 
  - `errors`: (Default) Only analyzes failed requests.
  - `always`: Analyzes every request for deep debugging.
  - `never`: Disables AI analysis while keeping the SDK active.
- **Terminal UI**: High-fidelity, color-coded "Inspekt Cards" for immediate developer feedback.

### 🛠️ Technical Improvements
- **Subpath Exports**: Optimized package structure allows users to import only the adapter they need (e.g., `inspekt-sdk/express`), preventing dependency bloat.
- **TypeScript First**: Full type definitions included (`.d.ts`) for excellent developer experience in both JS and TS environments.
- **Zero-Latency Design**: AI analysis runs in the background to ensure the end-user's request/response cycle is never delayed.

## [0.0.4] - 2026-05-09

### 🚀 Added
- **Production WebSocket Infrastructure**: Migrated to a stable, secure production environment at `wss://inspekt-engine-production.up.railway.app`.
- **Exponential Backoff with Jitter**: Implemented an intelligent reconnection strategy to prevent server thundering herds during network outages.
- **Enhanced NestJS Interceptor**: Added explicit error capturing using `catchError` to ensure 500 status codes are correctly reported to the engine before the response is finalized.

### 🛠️ Technical Improvements
- **ESM-Native Compatibility**: Fully optimized for Node.js 20+ ESM environments with proper subpath exports for generated clients.
- **Handshake Protocol**: Improved the initial connection handshake to include API key validation and redaction rule synchronization immediately upon socket open.
- **Protocol Security**: Enforced WSS (WebSocket Secure) for all production traffic to comply with modern browser security standards.
---
*Initial Release by [Olatunji Jamaldeen](https://github.com/jamaldeen09)*