import * as github from "@actions/github";

import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function purgeCacheByKey(key: string, message?: string) {
    try {
        utils.info(message || "");

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
    prefixes,
    time
}: {
    primaryKey: string;
    doUseLastAccessedTime: boolean;
    prefixes: string[];
    time: number;
}): Promise<void> {
    const verb = doUseLastAccessedTime ? "last accessed" : "created";

    const maxDate = utils.getMaxDate({ doUseLastAccessedTime, time });

    let caches: utils.Cache[] = [];

    if (prefixes.length > 0) {
        utils.info(
            `
            Purging cache(s) ${verb} before ${maxDate.toISOString()} and having key prefixes:
            
            ${utils.stringify(prefixes)}
            `
        );

        caches = filterCachesByTime({
            caches: await utils.getCachesByKeys(prefixes),
            doUseLastAccessedTime,
            maxDate
        });
    } else {
        utils.info(
            `Purging cache(s) ${verb} before ${maxDate.toISOString()} and having the key "${primaryKey}".`
        );

        caches = filterCachesByTime({
            caches: await utils.getCachesByKeys([primaryKey]),
            doUseLastAccessedTime,
            maxDate
        }).filter(x => utils.isExactKeyMatch(primaryKey, x.key));
    }

    if (inputs.purgeOverwrite == "never") {
        `The cache with the key "${primaryKey}" will be skipped because of "${Inputs.PurgeOverwrite}: never".`;

        caches.filter(x => !utils.isExactKeyMatch(primaryKey, x.key));
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
            const message = `the cache ${verb} at ${atDatePretty} and having the key "${cache.key}".`;
            if (atDate < maxDate) {
                await purgeCacheByKey(cache.key, `Purging ${message}`);
            } else {
                utils.info(`Skipping ${message}`);
            }
        }
    }
}

export async function purgeCachesByTime({
    primaryKey,
    time,
    prefixes
}: {
    primaryKey: string;
    time: number;
    prefixes: string[];
}): Promise<void> {
    // TODO https://github.com/actions/toolkit/pull/1378#issuecomment-1478388929

    for (const flag of [true, false]) {
        if (flag ? inputs.purgeLastAccessed : inputs.purgeCreatedMaxAge) {
            await purgeByTime({
                primaryKey,
                doUseLastAccessedTime: flag,
                prefixes: prefixes.slice(),
                time
            });
        }
    }
}
