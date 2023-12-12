import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function restoreCache(key: string, ref?: string) {
    utils.info(
        `Restoring a cache with the key "${key}"${
            ref ? ` and scoped to "${ref}"` : ""
        }.`
    );

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
        Restoring cache(s) using the "${Inputs.RestorePrefixesAllMatches}":
        ${utils.stringify(inputs.restorePrefixesAllMatches)}
        `
    );

    const caches = await utils.getCachesByPrefixes({
        prefixes: inputs.restorePrefixesAllMatches,
        useRef: true
    });

    utils.info(
        caches.length > 0
            ? `
            Found ${caches.length} cache(s):
            ${utils.stringify(caches)}
            `
            : "Found no cache(s)."
    );

    for (const cache of caches) {
        if (cache.key) {
            const cacheKey = await restoreCache(cache.key, cache.ref);
            if (cacheKey) {
                restoredCaches.push(...[cacheKey]);
            }
        }
    }

    if (caches.length > 0) {
        utils.info(`Finished restoring cache(s).`);
    }

    return restoredCaches;
}
