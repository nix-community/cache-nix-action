import * as cache from "@cache-nix-action/cache";
import * as core from "@actions/core";
import * as github from "@actions/github";
import dedent from "dedent";

import { Inputs, RefKey } from "../constants";
import * as inputs from "../inputs";
import { readdirSync, writeFileSync } from "fs";
import * as cacheUtils from "@cache-nix-action/cache/lib/internal/cacheUtils";

const myDedent = dedent.withOptions({});

export const info = (message: string) => core.info(myDedent(message));

export const warning = (message: string) => core.warning(myDedent(message));

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
    core.warning(`${warningPrefix} ${message}`);
}

export function logError(message: string): void {
    const prefix = "[error]";
    core.error(`${prefix} ${message}`);
}

// Cache token authorized for all events that are tied to a ref
// See GitHub Context https://docs.github.com/en/actions/learn-github-actions/contexts
export function isValidEvent(): boolean {
    return RefKey in process.env && Boolean(process.env[RefKey]);
}

export function isCacheFeatureAvailable(): boolean {
    if (cache.isFeatureAvailable()) {
        return true;
    }

    if (isGhes()) {
        logError(
            `Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.
            Otherwise please upgrade to GHES version >= 3.5 and If you are also using Github Connect, please unretire the actions/cache namespace before upgrade (see https://docs.github.com/en/enterprise-server@3.5/admin/github-actions/managing-access-to-actions-from-githubcom/enabling-automatic-access-to-githubcom-actions-using-github-connect#automatic-retirement-of-namespaces-for-actions-accessed-on-githubcom)`
        );
        return false;
    }

    logError(
        `
        Actions cache service is unavailable.
        Please check https://www.githubstatus.com/ for any ongoing issue in Actions.
        `
    );
    return false;
}

export async function restoreCache({
    primaryKey,
    restoreKeys,
    lookupOnly
}: {
    primaryKey: string;
    restoreKeys: string[];
    lookupOnly: boolean;
}) {
    let extraTarArgs: string[] = [];

    if (!lookupOnly) {
        const nixPaths = readdirSync("/nix/store").map(
            x => `../../../../../nix/store/${x}`
        );
        const tmp = await cacheUtils.createTempDirectory();
        const excludeFromFile = `${tmp}/nix-store-paths`;
        writeFileSync(excludeFromFile, nixPaths.join("\n"));
        extraTarArgs = ["--exclude-from", excludeFromFile];

        info(`::group::Logs produced while restoring a cache.`);
    }

    const key = await cache.restoreCache(
        inputs.paths,
        primaryKey,
        restoreKeys,
        { lookupOnly },
        false,
        extraTarArgs
    );

    if (!lookupOnly) {
        info(`::endgroup::`);
    }

    return key;
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

export async function getCachesByPrefixes({
    prefixes,
    useRef
}: {
    prefixes: string[];
    useRef: boolean;
}) {
    const caches: Cache[] = [];

    const octokit = github.getOctokit(inputs.token);

    for (let i = 0; i < prefixes.length; i += 1) {
        const key = prefixes[i];
        for (let page = 1; page <= 500; page += 1) {
            const { data: cachesRequest } =
                await octokit.rest.actions.getActionsCacheList({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    key,
                    per_page: 100,
                    page,
                    ref: useRef ? undefined : github.context.ref
                });

            if (cachesRequest.actions_caches.length == 0) {
                break;
            }

            caches.push(...cachesRequest.actions_caches);
        }
    }

    return caches;
}

export const mkMessageWrongValue = (input: string, value: string) =>
    `Wrong value for the input "${input}": ${value}`;

export function getMaxDate({
    doUseLastAccessedTime,
    time
}: {
    doUseLastAccessedTime: boolean;
    time: number;
}) {
    const inputMaxAge = doUseLastAccessedTime
        ? Inputs.PurgeLastAccessed
        : Inputs.PurgeCreated;

    const maxAge = core.getInput(inputMaxAge);

    const maxDate = new Date(time - Number.parseInt(maxAge) * 1000);

    if (maxDate === null) {
        throw new Error(mkMessageWrongValue(inputMaxAge, maxAge));
    }

    return maxDate;
}

export const stringify = (value: any) => JSON.stringify(value, null, 2);
