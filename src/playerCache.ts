import { mkdir, readdir, rm, stat, utimes, writeFile } from "fs/promises";
import { join } from "path";
import { cacheSize, playerScriptFetches } from "./metrics.ts";
import { PlayerScript } from "./player.ts";

const ignorePlayerScriptRegion = process.env.IGNORE_SCRIPT_REGION === "true";

function resolveCacheHome(): string {
    const xdgCacheHome = process.env.XDG_CACHE_HOME;
    if (xdgCacheHome) return xdgCacheHome;

    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) return localAppData;

    const home =
        process.env.HOME ??
        process.env.USERPROFILE ??
        (() => {
            const homeDrive = process.env.HOMEDRIVE;
            const homePath = process.env.HOMEPATH;
            if (homeDrive && homePath) return `${homeDrive}${homePath}`;
            return undefined;
        })();

    if (home) return join(home, ".cache");

    // last resort
    return join(process.cwd(), ".cache");
}

export const CACHE_HOME = resolveCacheHome();
export const CACHE_DIR = join(CACHE_HOME, 'yt-cipher', 'player_cache');

function isNotFound(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
    );
}

export async function getPlayerFilePath(playerScript: PlayerScript): Promise<string> {
    const playerUrl = playerScript.toUrl();
    let cacheKey: string;
    if (ignorePlayerScriptRegion) {
        // I have not seen any scripts that differ between regions so this should be safe
        cacheKey = playerScript.id;
    } else {
        // This hash of the player script url will mean that diff region scripts are treated as unequals, even for the same version #
        // I dont think I have ever seen 2 scripts of the same version differ between regions but if they ever do this will catch it
        // As far as player script access, I haven't ever heard about YT ratelimiting those either so ehh
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(playerUrl));
        cacheKey = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const filePath = join(CACHE_DIR, `${cacheKey}.js`);

    try {
        const fileStat = await stat(filePath);
        // updated time on file mark it as recently used.
        const mtime = fileStat.mtime ?? new Date();
        await utimes(filePath, new Date(), mtime);
        return filePath;
    } catch (error) {
        if (isNotFound(error)) {
            console.log(`Cache miss for player: ${playerUrl}. Fetching...`);
            const response = await fetch(playerUrl);
            playerScriptFetches.labels({ status: String(response.status) }).inc();
            if (!response.ok) {
                throw new Error(`Failed to fetch player from ${playerUrl}: ${response.statusText}`);
            }
            const playerContent = await response.text();
            await writeFile(filePath, playerContent);

            // Update cache size for metrics
            let fileCount = 0;
            for await (const _ of await readdir(CACHE_DIR)) {
                fileCount++;
            }
            cacheSize.labels({ cache_name: 'player' }).set(fileCount);

            console.log(`Saved player to cache: ${filePath}`);
            return filePath;
        }
        throw error;
    }
}

export async function initializeCache() {
    await mkdir(CACHE_DIR, { recursive: true });

    // Since these accumulate over time just cleanout 14 day unused ones
    let fileCount = 0;
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    console.log(`Cleaning up player cache directory: ${CACHE_DIR}`);
    for await (const dirEntry of await readdir(CACHE_DIR, { withFileTypes: true })) {
        if (dirEntry.isFile()) {
            const filePath = join(CACHE_DIR, dirEntry.name);
            const fileStat = await stat(filePath);
            const lastAccessed = fileStat.atime?.getTime() ?? fileStat.mtime?.getTime() ?? fileStat.birthtime?.getTime();
            if (lastAccessed && (Date.now() - lastAccessed > fourteenDays)) {
                console.log(`Deleting stale player cache file: ${filePath}`);
                await rm(filePath);
            } else {
                fileCount++;
            }
        }
    }
    cacheSize.labels({ cache_name: 'player' }).set(fileCount);
    console.log(`Player cache directory ensured at: ${CACHE_DIR}`);
}
