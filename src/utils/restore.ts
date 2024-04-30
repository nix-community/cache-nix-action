import { copyFileSync } from "fs";

import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";
import { cacheUtils } from "./cacheBackend";
import { mergeStoreDatabases } from "./mergeStoreDatabases";

export async function restoreCache(key: string, ref?: string) {
    const tempDir = await cacheUtils.createTempDirectory();
    const dbPath = "/nix/var/nix/db/db.sqlite";
    const dbPath1 = `${tempDir}/old.sqlite`;
    const dbPath2 = `${tempDir}/new.sqlite`;

    if (inputs.nix) {
        utils.info(`Copying "${dbPath}" to "${dbPath1}".`);
        copyFileSync(dbPath, dbPath1);
    }

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

        if (inputs.nix) {
            utils.info(`Copying "${dbPath}" to "${dbPath2}".`);

            copyFileSync(dbPath, dbPath2);

            utils.info(
                `
                Merging store databases "${dbPath1}" and "${dbPath2}"
                into "${dbPath}".
                `
            );

            await mergeStoreDatabases(tempDir, dbPath1, dbPath2, dbPath);

            utils.info(`Checking the store database.`);

            await utils.run(`sqlite3 "${dbPath}" 'PRAGMA integrity_check;'`);
        }

        return cacheKey;
    } else {
        utils.info(`Failed to restore the cache.`);
    }
}

export async function restoreAllMatches() {
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
