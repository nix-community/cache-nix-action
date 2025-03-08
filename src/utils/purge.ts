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

async function purgeCachesByPrefixes({
    primaryKey,
    prefixes,
    doUseTime,
    doUseLastAccessedTime,
    time
}: {
    primaryKey: string;
    prefixes: string[];
    doUseTime: boolean;
    doUseLastAccessedTime: boolean;
    time: number;
}): Promise<void> {
    const verb = doUseLastAccessedTime ? "last accessed" : "created";

    let caches: utils.Cache[] = [];

    if (prefixes.length > 0) {
        const maxDate = utils.getMaxDate({ doUseLastAccessedTime, time });

        utils.info(
            `
            Purging cache(s) ${doUseTime ? `${verb} before ${maxDate.toISOString()}, ` : ""}scoped to "${
                github.context.ref
            }"${doUseTime ? "," : ""} and with one of the key prefixes:
            ${utils.stringify(prefixes)}
            `
        );

        const cachesFound = await utils.getCachesByPrefixes({
            prefixes,
            anyRef: false
        });

        if (doUseTime) {
            caches = filterCachesByTime({
                caches: cachesFound,
                doUseLastAccessedTime,
                maxDate
            });
        }
    } else {
        utils.info(
            `
            No "${Inputs.PurgePrefixes}" specified.
            Not purging caches.
            `
        );

        return;
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
        inputs.purgePrimaryKey === "never" &&
        caches.filter(x => utils.isExactKeyMatch(primaryKey, x.key)).length > 0
    ) {
        utils.info(
            `Skipping cache(s) with the key "${primaryKey}" because of "${Inputs.PurgePrimaryKey}: never".`
        );

        caches = caches.filter(x => !utils.isExactKeyMatch(primaryKey, x.key));
    }

    for (const cache of caches) {
        if (cache.key) {
            if (doUseTime) {
                const at = doUseLastAccessedTime
                    ? cache.last_accessed_at
                    : cache.created_at;
                if (at) {
                    const atDate = new Date(at);
                    const atDatePretty = atDate.toISOString();
                    await purgeCacheByKey(
                        cache.key,
                        `Purging the cache that was ${verb} at ${atDatePretty} and that has the key "${cache.key}".`
                    );
                }
            } else {
                await purgeCacheByKey(
                    cache.key,
                    `Purging the cache with the key "${cache.key}".`
                );
            }
        }
    }

    utils.info(`Finished purging cache(s).`);
}

export async function purgeCaches({
    primaryKey,
    time,
    prefixes
}: {
    primaryKey: string;
    time: number;
    prefixes: string[];
}): Promise<void> {
    if (
        inputs.purgeLastAccessed === undefined &&
        inputs.purgeCreated === undefined
    ) {
        purgeCachesByPrefixes({
            primaryKey,
            prefixes,
            doUseTime: false,
            doUseLastAccessedTime: false,
            time
        });
    } else {
        for (const doUseLastAccessedTime of [true, false]) {
            if (
                (doUseLastAccessedTime
                    ? inputs.purgeLastAccessed
                    : inputs.purgeCreated) !== undefined
            ) {
                await purgeCachesByPrefixes({
                    primaryKey,
                    prefixes,
                    doUseTime: true,
                    doUseLastAccessedTime,
                    time
                });
            }
        }
    }
}
