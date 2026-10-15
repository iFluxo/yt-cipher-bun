import { Counter, Gauge, Registry } from "prom-client";

export const registry = new Registry();

export const endpointHits = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests.",
    labelNames: ["pathname", "player_id", "player_type"],
    registers: [registry],
});

export const userAgentRequests = new Counter({
    name: "http_requests_by_user_agent_total",
    help: "Total number of HTTP requests by user agent.",
    labelNames: ["user_agent"],
    registers: [registry],
});

export const responseCodes = new Counter({
    name: "http_responses_total",
    help: "Total number of HTTP responses.",
    labelNames: ["pathname", "status", "player_id", "player_type"],
    registers: [registry],
});

export const workerErrors = new Counter({
    name: "worker_errors_total",
    help: "Total number of worker errors.",
    labelNames: ["player_id", "player_type", "message"],
    registers: [registry],
});

export const playerScriptOverwrites = new Counter({
    name: "player_script_overwrites_total",
    help: "Total number of player script overwrites, e.g. when forcing a specific player version.",
    labelNames: ["type", "source", "forced"],
    registers: [registry],
});

export const cacheSize = new Gauge({
    name: "cache_size",
    help: "The number of items in the cache.",
    labelNames: ["cache_name"],
    registers: [registry],
});

export const playerUrlRequests = new Counter({
    name: "player_url_requests_total",
    help: "Total number of requests for each player ID.",
    labelNames: ["player_id", "player_type"],
    registers: [registry],
});

export const playerScriptFetches = new Counter({
    name: "player_script_fetches_total",
    help: "Total number of player script fetches by response status.",
    labelNames: ["status"],
    registers: [registry],
});
