import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";
import { cacheUtils } from "./cacheBackend";
import { mergeStoreDatabases } from "./mergeStoreDatabases";

export async function restoreCache(key: string, ref?: string) {
    const tempDir = await cacheUtils.createTempDirectory();
    const dbStorePath = "/nix/var/nix/db/db.sqlite";
    const dbOldPath = `${tempDir}/old.sqlite`;
    const dbNewPath = `${tempDir}/new.sqlite`;
    const dbMergedPath = `${tempDir}/merged.sqlite`;

    const group = inputs.choose("runner", "staff", "");
    
    if (inputs.nix) {
        utils.info(`Copying "${dbStorePath}" to "${dbOldPath}".`);
        
        await utils.run(`
            sudo cp ${dbStorePath} ${dbOldPath};
            sudo chown runner:${group} ${dbOldPath}
        `)
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
            utils.info(`Copying "${dbStorePath}" to "${dbNewPath}".`);

            await utils.run(`
                sudo cp ${dbStorePath} ${dbNewPath};
                sudo chown runner:${group} ${dbNewPath}
            `)

            utils.info(
                `
                Merging store databases "${dbOldPath}" and "${dbNewPath}"
                into the new database "${dbMergedPath}".
                `
            );

            await mergeStoreDatabases(
                tempDir,
                dbOldPath,
                dbNewPath,
                dbMergedPath,
                dbStorePath
            );
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
        anyRef: true
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
