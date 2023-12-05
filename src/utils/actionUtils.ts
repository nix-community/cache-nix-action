import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs, RefKey } from "../constants";

export function isGhes(): boolean {
    const ghUrl = new URL(
        process.env["GITHUB_SERVER_URL"] || "https://github.com"
    );
    return ghUrl.hostname.toUpperCase() !== "GITHUB.COM";
}

export function isExactKeyMatch(key: string, cacheKey?: string): boolean {
    return !!(
        cacheKey &&
        cacheKey.localeCompare(key, undefined, {
            sensitivity: "accent"
        }) === 0
    );
}

export function logWarning(message: string): void {
    const warningPrefix = "[warning]";
    core.info(`${warningPrefix}${message}`);
}

export function logError(message: string): void {
    const prefix = "[error]";
    core.error(`${prefix} ${message}`);
}

// Cache token authorized for all events that are tied to a ref
// See GitHub Context https://help.github.com/actions/automating-your-workflow-with-github-actions/contexts-and-expression-syntax-for-github-actions#github-context
export function isValidEvent(): boolean {
    return RefKey in process.env && Boolean(process.env[RefKey]);
}

export function getInputAsArray(
    name: string,
    options?: core.InputOptions
): string[] {
    return core
        .getInput(name, options)
        .split("\n")
        .map(s => s.replace(/^!\s+/, "!").trim())
        .filter(x => x !== "");
}

export function getInputAsInt(
    name: string,
    options?: core.InputOptions
): number | undefined {
    const value = parseInt(core.getInput(name, options));
    if (isNaN(value) || value < 0) {
        return undefined;
    }
    return value;
}

export function getInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}

export function isCacheFeatureAvailable(): boolean {
    if (cache.isFeatureAvailable()) {
        return true;
    }

    if (isGhes()) {
        logWarning(
            `Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.
            Otherwise please upgrade to GHES version >= 3.5 and If you are also using Github Connect, please unretire the actions/cache namespace before upgrade (see https://docs.github.com/en/enterprise-server@3.5/admin/github-actions/managing-access-to-actions-from-githubcom/enabling-automatic-access-to-githubcom-actions-using-github-connect#automatic-retirement-of-namespaces-for-actions-accessed-on-githubcom)`
        );
        return false;
    }

    logWarning(
        "An internal error has occurred in cache backend. Please check https://www.githubstatus.com/ for any ongoing issue in actions."
    );
    return false;
}

export const paths = ["/nix/", "~/.cache/nix", "~root/.cache/nix"];

export async function getCacheKey({
    paths,
    primaryKey,
    restoreKeys,
    lookupOnly
}: {
    paths: string[];
    primaryKey: string;
    restoreKeys: string[];
    lookupOnly: boolean;
}) {
    return await cache.restoreCache(
        // https://github.com/actions/toolkit/pull/1378#issuecomment-1478388929
        paths.slice(),
        primaryKey,
        restoreKeys,
        { lookupOnly },
        false
    );
}

export interface Cache {
    id?: number | undefined;
    ref?: string | undefined;
    key?: string | undefined;
    version?: string | undefined;
    last_accessed_at?: string | undefined;
    created_at?: string | undefined;
    size_in_bytes?: number | undefined;
}

export async function getCachesByKeys(token: string, keys: string[]) {
    const caches: Cache[] = [];

    const octokit = github.getOctokit(token);

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        for (let page = 1; page <= 500; page += 1) {
            const { data: cachesRequest } =
                await octokit.rest.actions.getActionsCacheList({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    key,
                    per_page: 100,
                    page,
                    ref: github.context.ref
                });

            if (cachesRequest.actions_caches.length == 0) {
                break;
            }

            caches.push(...cachesRequest.actions_caches);
        }
    }

    return caches;
}

export const filterCachesByTime = ({
    caches,
    doUseLastAccessedTime,
    maxDate
}: {
    caches: Cache[];
    doUseLastAccessedTime: boolean;
    maxDate: Date;
}) =>
    caches.filter(cache => {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at !== undefined && cache.id !== undefined) {
            const atDate = new Date(at);
            return atDate < maxDate;
        } else return false;
    });

export const mkMessageWrongValue = (input: string, value: string) =>
    `Wrong value for the input '${input}': ${value}`;

export function getMaxDate({
    doUseLastAccessedTime,
    time
}: {
    doUseLastAccessedTime: boolean;
    time: number;
}) {
    const inputMaxAge = doUseLastAccessedTime
        ? Inputs.PurgeAccessedMaxAge
        : Inputs.PurgeCreatedMaxAge;

    const maxAge = core.getInput(inputMaxAge, { required: false });

    const maxDate = new Date(time - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        throw new Error(mkMessageWrongValue(inputMaxAge, maxAge));
    }

    return maxDate;
}

export const stringify = (value: any) => JSON.stringify(value, null, 2);
