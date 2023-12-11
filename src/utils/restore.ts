import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function restoreCache(key: string) {
    utils.info(`Restoring a cache with the key "${key}".`);

    const cacheKey = await utils.restoreCache({
        primaryKey: key,
        restoreKeys: [],
        lookupOnly: false
    });

    if (cacheKey) {
        utils.info(`Finished restoring the cache.`);
        return cacheKey;
    } else {
        utils.info(`Failed to restore the cache.`);
    }
}

export async function restoreCaches() {
    const restoredCaches: string[] = [];

    if (inputs.restorePrefixesAllMatches.length == 0) {
        return restoredCaches;
    }

    utils.info(
        `
        Searching for caches using the "${Inputs.RestorePrefixesAllMatches}":
        
        ${utils.stringify(inputs.restorePrefixesAllMatches)}
        `
    );

    const caches = await utils.getCachesByKeys(
        inputs.restorePrefixesAllMatches
    );

    utils.info(
        `
        Found ${caches.length} cache(s):
        
        ${utils.stringify(caches)}
        `
    );

    for (const cache of caches) {
        if (cache.key) {
            const cacheKey = await restoreCache(cache.key);
            if (cacheKey) {
                restoredCaches.push(...[cacheKey]);
            }
        }
    }

    return restoredCaches;
}
