import * as github from "@actions/github";

import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function purgeCacheByKey(key: string, message?: string) {
    try {
        utils.info(`Purging the cache with the key "${key}" ${message}.`);

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
            Failed to delete the cache.
            
            ${error}
            `
        );
    }
}

export const filterCachesByTime = ({
    caches,
    doUseLastAccessedTime,
    maxDate
}: {
    caches: utils.Cache[];
    doUseLastAccessedTime: boolean;
    maxDate: Date;
}) =>
    caches.filter(cache => {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at !== undefined && cache.key !== undefined) {
            const atDate = new Date(at);
            return atDate < maxDate;
        } else return false;
    });

async function purgeByTime({
    primaryKey,
    doUseLastAccessedTime,
    keys,
    time
}: {
    primaryKey: string;
    doUseLastAccessedTime: boolean;
    keys: string[];
    time: number;
}): Promise<void> {
    const verb = doUseLastAccessedTime ? "last accessed" : "created";

    const maxDate = utils.getMaxDate({ doUseLastAccessedTime, time });

    utils.info(
        `
        Purging caches ${verb} before ${maxDate.toISOString()} and having key prefixes:
        
        ${utils.stringify(keys)}
        `
    );

    const caches = filterCachesByTime({
        caches: await utils.getCachesByKeys(keys),
        doUseLastAccessedTime,
        maxDate
    });

    if (inputs.purgeOverwrite == "never") {
        `The cache with the key "${primaryKey}" will be excluded because of "${Inputs.PurgeOverwrite}: never".`;

        caches.filter(x => x.key != primaryKey);
    }

    utils.info(
        `
        Found ${caches.length} cache(s):
        
        ${utils.stringify(caches)}
        `
    );

    for (const cache of caches) {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at !== undefined && cache.key !== undefined) {
            const atDate = new Date(at);
            const atDatePretty = atDate.toISOString();
            if (atDate < maxDate) {
                await purgeCacheByKey(
                    cache.key,
                    ` and ${verb} at ${atDatePretty}`
                );
            } else {
                utils.info(
                    `Skipping the cache with the key "${cache.key}" and ${verb} at ${atDatePretty}`
                );
            }
        }
    }
}

export async function purgeCachesByTime({
    primaryKey,
    time,
    keys
}: {
    primaryKey: string;
    time: number;
    keys: string[];
}): Promise<void> {
    // TODO https://github.com/actions/toolkit/pull/1378#issuecomment-1478388929
    const purgeKeys = keys.slice().filter(key => key.trim().length > 0);

    for (const flag of [true, false]) {
        if (flag ? inputs.purgeLastAccessedMaxAge : inputs.purgeCreatedMaxAge) {
            await purgeByTime({
                primaryKey,
                doUseLastAccessedTime: flag,
                keys: purgeKeys,
                time
            });
        }
    }
}
