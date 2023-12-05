import * as core from "@actions/core";
import * as github from "@actions/github";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

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

    const token = core.getInput(Inputs.Token, { required: true });

    const caches = utils.filterCachesByTime({
        caches: await utils.getCachesByKeys(token, keys),
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

    const octokit = github.getOctokit(token);

    caches.forEach(async cache => {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at !== undefined && cache.id !== undefined) {
            const atDate = new Date(at);
            const atDatePretty = atDate.toISOString();
            if (atDate < maxDate) {
                utils.info(
                    `Deleting the cache having the key '${cache.key}' and ${verb} at ${atDatePretty}`
                );

                try {
                    await octokit.rest.actions.deleteActionsCacheById({
                        per_page: 100,
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        cache_id: cache.id
                    });
                } catch (error) {
                    utils.info(
                        `
                        Failed to delete cache ${cache.key}
                        
                        ${error}
                        `
                    );
                }
            } else {
                utils.info(
                    `Skipping the cache having the key '${cache.key}' and ${verb} at ${atDatePretty}`
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
    const accessed = core.getInput(Inputs.PurgeAccessed) === "true";

    const created = core.getInput(Inputs.PurgeCreated) === "true";

    let purgeKeys = utils.getInputAsArray(Inputs.PurgeKeys);

    if (purgeKeys.length == 0) {
        purgeKeys.push(...[key]);
    }

    purgeKeys = purgeKeys.filter(key => key.trim().length > 0);

    const results: utils.Cache[] = [];

    if (accessed || created) {
        if (accessed) {
            results.push(
                ...(await purgeByTime({
                    doUseLastAccessedTime: true,
                    keys: purgeKeys,
                    lookupOnly,
                    time
                }))
            );
        }
        if (created) {
            results.push(
                ...(await purgeByTime({
                    doUseLastAccessedTime: false,
                    keys: purgeKeys,
                    lookupOnly,
                    time
                }))
            );
        }
    } else {
        core.warning("Either `accessed` or `created` input should be `true`.");
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
    const purgeEnabled = utils.getInputAsBool(Inputs.Purge);

    const results: utils.Cache[] = [];

    if (purgeEnabled) {
        results.push(...(await purge({ key, lookupOnly, time })));
    }

    return results;
}
