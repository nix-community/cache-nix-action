import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function restoreWithKey(key: string) {
    utils.info(`Restoring a cache with the key "${key}".`);

    utils.info(
        `::group::Logs are hidden. Errors are due to attempts to overwrite read-only paths.`
    );

    const cacheKey = await utils.getCacheKey({
        primaryKey: key,
        restoreKeys: [],
        lookupOnly: false
    });

    utils.info(`::endgroup::`);

    if (cacheKey) {
        utils.info(`Finished restoring the cache.`);
        return cacheKey;
    } else {
        utils.info(`Failed to restore the cache.`);
    }
}

export async function restoreCaches() {
    const restoredCaches: string[] = [];

    if (inputs.prefixesAllMatches.length == 0) {
        return restoredCaches;
    }

    utils.info(
        `
        Searching for caches using the "${Inputs.PrefixesAllMatches}":
        
        ${utils.stringify(inputs.prefixesAllMatches)}
        `
    );

    const caches = await utils.getCachesByKeys(inputs.prefixesAllMatches);

    utils.info(
        `
        Found ${caches.length} cache(s):
        
        ${utils.stringify(caches)}
        `
    );

    for (const cache of caches) {
        if (cache.key) {
            const cacheKey = await restoreWithKey(cache.key);
            if (cacheKey) {
                restoredCaches.push(...[cacheKey]);
            }
        }
    }

    return restoredCaches;
}
