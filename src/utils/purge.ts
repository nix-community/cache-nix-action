import * as github from "@actions/github";

import * as inputs from "../inputs";
import * as utils from "./action";

export async function purgeCacheByKey(key: string) {
    try {
        await utils.octokit.rest.actions.deleteActionsCacheByKey({
            per_page: 100,
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            key,
            ref: github.context.ref
        });
    } catch (error) {
        utils.info(
            `
            Failed to delete the cache with the key "${key}".
            
            ${error}
            `
        );
    }
}

async function purgeByTime({
    doUseLastAccessedTime,
    keys,
    lookupOnly,
    time
}: {
    doUseLastAccessedTime: boolean;
    keys: string[];
    lookupOnly: boolean;
    time: number;
}): Promise<utils.Cache[]> {
    const verb = doUseLastAccessedTime ? "last accessed" : "created";

    const maxDate = utils.getMaxDate({ doUseLastAccessedTime, time });

    utils.info(
        `
        ${
            lookupOnly ? "Searching for" : "Purging"
        } caches ${verb} before ${maxDate.toISOString()} and having key prefixes:
        
        ${utils.stringify(keys)}
        `
    );

    const caches = utils.filterCachesByTime({
        caches: await utils.getCachesByKeys(keys),
        doUseLastAccessedTime,
        maxDate
    });

    utils.info(
        `
        Found ${caches.length} cache(s):
        
        ${utils.stringify(caches)}
        `
    );

    if (lookupOnly) {
        return caches;
    }

    caches.forEach(async cache => {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at !== undefined && cache.key !== undefined) {
            const atDate = new Date(at);
            const atDatePretty = atDate.toISOString();
            if (atDate < maxDate) {
                utils.info(
                    `Deleting the cache with the key '${cache.key}' and ${verb} at ${atDatePretty}`
                );

                await purgeCacheByKey(cache.key);
            } else {
                utils.info(
                    `Skipping the cache with the key '${cache.key}' and ${verb} at ${atDatePretty}`
                );
            }
        }
    });

    return [];
}

async function purge({
    key,
    lookupOnly,
    time
}: {
    key: string;
    lookupOnly: boolean;
    time: number;
}): Promise<utils.Cache[]> {
    const purgeOverwrite = inputs.purgeOverwrite;

    // TODO
    let purgeKeys = inputs.purgeKeys.slice();

    if (purgeOverwrite == "default") {
        purgeKeys.push(...[key]);
    }

    purgeKeys = inputs.purgeKeys.filter(key => key.trim().length > 0);

    const results: utils.Cache[] = [];

    if (inputs.purgeAccessedMaxAge) {
        results.push(
            ...(await purgeByTime({
                doUseLastAccessedTime: true,
                keys: purgeKeys,
                lookupOnly,
                time
            }))
        );
    }

    if (inputs.purgeCreatedMaxAge) {
        results.push(
            ...(await purgeByTime({
                doUseLastAccessedTime: false,
                keys: purgeKeys,
                lookupOnly,
                time
            }))
        );
    }

    return results;
}

export async function purgeCaches({
    key,
    lookupOnly,
    time
}: {
    key: string;
    lookupOnly: boolean;
    time: number;
}): Promise<utils.Cache[]> {
    const results: utils.Cache[] = [];

    if (inputs.purge) {
        results.push(...(await purge({ key, lookupOnly, time })));
    }

    return results;
}
