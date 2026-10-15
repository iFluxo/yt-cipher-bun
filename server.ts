import { initializeWorkers } from "./src/workerPool.ts";
import { initializeCache } from "./src/playerCache.ts";
import { handleDecryptSignature } from "./src/handlers/decryptSignature.ts";
import { handleGetSts } from "./src/handlers/getSts.ts";
import { handleResolveUrl } from "./src/handlers/resolveUrl.ts";
import { withMetrics } from "./src/middleware.ts";
import { withPlayer } from "./src/middleware/player.ts";
import { withValidation } from "./src/validation.ts";
import { registry } from "./src/metrics.ts";
import type { ApiRequest, RequestContext } from "./src/types.ts";

const API_TOKEN = process.env.API_TOKEN;

async function serveFile(path: string, contentType: string, notFoundMessage: string): Promise<Response> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
        return new Response(notFoundMessage, {
            status: 404,
            headers: { "Content-Type": "text/plain" },
        });
    }
    return new Response(await file.arrayBuffer(), {
        status: 200,
        headers: { "Content-Type": contentType },
    });
}

async function baseHandler(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === "GET") {
        if (pathname === "/") {
            return serveFile(
                "./docs/index.html",
                "text/html",
                "Homepage not found. Please refer to the API spec at https://github.com/kikkia/yt-cipher?tab=readme-ov-file#api-specification",
            );
        }
        if (pathname === "/swagger.yaml") {
            return serveFile("./docs/swagger.yaml", "application/yaml", "Swagger spec not found");
        }
    }

    if (pathname === '/metrics') {
        return new Response(await registry.metrics(), {
            headers: { "Content-Type": registry.contentType },
        });
    }

    const authHeader = req.headers.get("authorization");
    if (API_TOKEN && API_TOKEN !== "") {
        if (authHeader !== API_TOKEN) {
            const error = authHeader ? 'Invalid API token' : 'Missing API token';
            return new Response(JSON.stringify({ error }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
    }

    let handle: (ctx: RequestContext) => Promise<Response>;

    if (pathname === '/decrypt_signature') {
        handle = handleDecryptSignature;
    } else if (pathname === '/get_sts') {
        handle = handleGetSts;
    } else if (pathname === '/resolve_url') {
        handle = handleResolveUrl;
    } else {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    let body: ApiRequest;
    try {
        body = await req.json() as ApiRequest;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const ctx: RequestContext = { req, body };

    const composedHandler = withValidation(withPlayer(withMetrics(handle)));
    return await composedHandler(ctx);
}

const port = Number(process.env.PORT) || 8001;
const host = process.env.HOST || '0.0.0.0';

await initializeCache();
initializeWorkers();

console.log(`Server listening on http://${host}:${port}`);
Bun.serve({
    port,
    hostname: host,
    fetch: baseHandler,
});
