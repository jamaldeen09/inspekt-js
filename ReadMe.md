# inspekt-js

Official JavaScript/TypeScript SDK for [Inspekt](LINK_COMING_SOON) drop-in middleware that silently monitors your API responses and surfaces AI-powered diagnostics directly in your terminal. No dashboards to open and no manual debugging, just run your server and inspekt tells you what's wrong and why.

## **Supports:** Express · NestJS · Fastify

## How It Works

Inspekt operates as a high-fidelity diagnostic layer within your server's response lifecycle. By default, the SDK monitors for 4xx and 5xx errors—though this is fully configurable to your specific needs.

When a failure is detected, the SDK captures the essential request and response metadata and securely transmits it to the Inspekt Diagnostic Engine. Our high-reasoning AI performs an immediate "autopsy" of the execution context, streaming a structured, actionable diagnosis directly back to your terminal or dashboard.

**The result:** Your users experience zero latency, and you never have to guess why a request failed again

## Installation

```bash
npm install @inspekt/js
```

**Note**: For NestJS or Fastify support, ensure you have @nestjs/common or fastify installed in your project.

## Quick Start

Get your API key from your [Inspekt Dashboard](LINK_COMING_SOON).

## Usage

**ES Modules (TypeScript/Modern JS):**

```javascript
import { Inspekt } from "@inspekt/js";
import inspektExpress from "@inspekt/js/express";
import InspektInterceptor from "@inspekt/js/nest";
import inspektFastify from "@inspekt/js/fastify";
```

**CommonJS (TypeScript/Modern JS):**

```javascript
const { Inspekt } = require("@inspekt/js");
const inspektExpress = require("@inspekt/js/express").default;
const InspektInterceptor = require("@inspekt/js/nest").default;
const inspektFastify = require("@inspekt/js/fastify").default;
```

### Express

```typescript
import express from "express";
import { Inspekt } from "@inspekt/js";
import inspektExpress from "@inspekt/js/express";

const app = express();

const inspekt = new Inspekt({
  apiKey: "ins_live_your_key_here",
  analysisMode: "errors", // Only analyze 4xx and 5xx responses
  redactKeys: ["password", "card_number"], // Sensitive keys to scrub before AI analysis
});

// Establish the WebSocket connection for real-time diagnostics
inspekt.connect();

// Apply as global middleware — ensure this is placed early in your stack
app.use(inspektExpress(inspekt));

app.get("/users/:id", (req, res) => {
  res.status(404).json({
    error: "User not found",
  });
});

app.listen(3000);
```

### NestJS

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Inspekt } from "@inspekt/js";
import InspektInterceptor from "@inspekt/js/nest";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const inspekt = new Inspekt({
    apiKey: "ins_live_your_key_here",
    analysisMode: "errors",
  });

  // Initialize the diagnostic stream
  inspekt.connect();

  // Apply globally as an interceptor
  app.useGlobalInterceptors(new InspektInterceptor(inspekt));
  await app.listen(3000);
}

bootstrap();
```

### Fastify

```typescript
import Fastify from "fastify";
import { Inspekt } from "@inspekt/js";
import inspektFastify from "@inspekt/js/fastify";

const fastify = Fastify();

const inspekt = new Inspekt({
  apiKey: "ins_live_your_key_here",
  analysisMode: "errors",
});

// Initialize the diagnostic stream
inspekt.connect();

// Register as a Fastify plugin
fastify.register(inspektFastify(inspekt));

fastify.get("/orders/:id", async (request, reply) => {
  reply.status(500).send({
    error: "Database connection failed",
  });
});

fastify.listen({ port: 3000 });
```

---

## Configuration

```typescript
const inspekt = new Inspekt({
  apiKey: "your_key_here", // Required
  analysisMode: "errors", // Optional — default: 'errors'
  redactKeys: ["x-internal-token"], // Optional — keys to redact
  terminalOutput: true, // Optional — default: true
});
```

---

## Options

- **`apiKey`** (string) — **Required**
  Your unique 57 character Inspekt API key. Must start with `ins_live_`.

- **`analysisMode`** (`'errors' | 'always' | 'never'`) — Default: `'errors'`
  Controls the Diagnostic Engine behavior:
  - `errors`: Analyzes only 4xx and 5xx failures (Recommended for production).
  - `always`: Triggers an AI Autopsy for every request (Useful for deep debugging).
  - `never`: Disables AI analysis but continues to capture and stream raw logs.

- **`redactKeys`** (string[]) — Default: `['authorization', 'cookie']`
  A list of sensitive keys in the request body or headers. Inspekt scrubs these locally, replacing values with `[REDACTED]` before they ever leave your server.

- **`terminalOutput`** (boolean) — Default: `true`
  Toggle whether the AI Autopsy and log summaries are streamed directly to your local development console.

- **`catchExceptions`** (boolean) — Default: `true`
  When enabled, Inspekt automatically captures unhandled exceptions and triggers a high-priority critical diagnostic report.

---                        |

## Terminal Output
When Inspekt detects an error worth analyzing, it streams a high-fidelity AI Autopsy directly to your terminal:

## Example 
POST /test-inspekt  15:58:37

INSPEKT ───────────────────────────────────────── WARNING

Authentication failure due to revoked API key
401 · Unauthorized

Diagnosis
   The client sent a POST request with an Authorization header containing a redacted
   API key. The server's authentication middleware validated the key against its
   store and found it revoked, triggering an auth_failure event. The response
   includes a JSON payload with error details and a suggestion to consult the
   Inspekt dashboard for active keys.

Issues
   · Invalid or revoked API key provided
   · Missing valid authentication credentials

Security & Headers
   · FLAG x-powered-by header may reveal server technology
   · FLAG Missing WWW-Authenticate header for 401 response
   · MISSING WWW-Authenticate

Performance & Body
   · BODY Response body includes auth_failure event and suggestion to check dashboard
   · BODY Content-Length header matches body size

Fixes
   · Regenerate a new API key from Inspekt dashboard
   · Update client to use the new key in Authorization header
   · Implement key rotation and monitoring
─────────────────────────────────────────────────────────

Severity is color-coded:
- 🟢 `OK` — green
- 🟡 `WARNING` — yellow
- 🔴 `CRITICAL` — red

---

## Analysis Modes

```typescript
// Only analyze failed requests (Recommended for Production)
analysisMode: 'errors'

// Analyze every single request (Useful for deep debugging sessions)
analysisMode: 'always'

// Disable AI diagnostics; continues to capture and stream raw logs without AI insights
analysisMode: 'never'
```

---

## Sensitive Data Redaction
Inspekt automatically redacts `authorization`, `cookie`, and `set-cookie` headers before sending anything to the AI engine. You can extend this list:

```typescript
const inspekt = new Inspekt({
  apiKey: "ins_live_your_key_here",
  redactKeys: ["x-api-secret", "x-internal-token", "stripe-signature"],
});
```

Redacted values appear as `[REDACTED]` in the AI analysis.
---

## API Key Format
All Inspekt API keys follow this format: ins_live_...
Keys that don't match this format will throw immediately on initialization, no silent failures.

```typescript
// Throws: [Inspekt] Invalid API Key format. Keys should start with "ins_live_"
const inspekt = new Inspekt({ apiKey: "wrong_key" });
```

**Get your key at [inspekt.app](LINK_COMING_SOON).**

## Roadmap

- [x] Express support
- [x] NestJS support
- [x] Fastify support
- [x] Dashboard log viewer
- [ ] Python SDK (`inspekt-py`)
---

## License
MIT © [Olatunji Jamaldeen](https://github.com/jamaldeen09/inspekt-js)
