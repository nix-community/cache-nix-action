import * as github from "@actions/github";

import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function purgeCacheByKey(key: string, message?: string) {
    try {
        utils.info(message || "");

        const octokit = github.getOctokit(inputs.token);

        await octokit.rest.actions.deleteActionsCacheByKey({
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
        if (at && cache.key) {
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
            Purging cache(s) ${verb} before ${maxDate.toISOString()}, scoped to "${
                github.context.ref
            }", and with one of the key prefixes:
            ${utils.stringify(prefixes)}
            `
        );

        const cachesFound = await utils.getCachesByPrefixes(prefixes);

        caches = filterCachesByTime({
            caches: cachesFound,
            doUseLastAccessedTime,
            maxDate
        });
    } else {
        utils.info(
            `Purging cache(s) ${verb} before ${maxDate.toISOString()}, scoped to "${
                github.context.ref
            }", and with the key "${primaryKey}".`
        );

        const cachesFound = await utils.getCachesByPrefixes([primaryKey]);

        caches = filterCachesByTime({
            caches: cachesFound,
            doUseLastAccessedTime,
            maxDate
        }).filter(x => utils.isExactKeyMatch(primaryKey, x.key));
    }

    utils.info(
        caches.length > 0
            ? `
            Found ${caches.length} cache(s):
            ${utils.stringify(caches)}
            `
            : `Found no cache(s).`
    );

    if (
        inputs.purgeOverwrite == "never" &&
        caches.filter(x => utils.isExactKeyMatch(primaryKey, x.key)).length > 0
    ) {
        utils.info(
            `Skipping cache(s) with the key "${primaryKey}" because of "${Inputs.PurgeOverwrite}: never".`
        );

        caches = caches.filter(x => !utils.isExactKeyMatch(primaryKey, x.key));
    }

    for (const cache of caches) {
        const at = doUseLastAccessedTime
            ? cache.last_accessed_at
            : cache.created_at;
        if (at && cache.key) {
            const atDate = new Date(at);
            const atDatePretty = atDate.toISOString();
            await purgeCacheByKey(
                cache.key,
                `Purging the cache ${verb} at ${atDatePretty} with the key "${cache.key}".`
            );
        }
    }

    utils.info(`Finished purging cache(s).`);
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

    for (const doUseLastAccessedTime of [true, false]) {
        if (
            (doUseLastAccessedTime
                ? inputs.purgeLastAccessed
                : inputs.purgeCreated) !== undefined
        ) {
            await purgeByTime({
                primaryKey,
                doUseLastAccessedTime,
                prefixes: prefixes.slice(),
                time
            });
        }
    }
}
