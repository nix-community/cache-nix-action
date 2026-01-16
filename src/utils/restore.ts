import { existsSync } from 'fs';
import { dbStorePath as dbStandardPath, Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";
import { cacheUtils } from "./cacheBackend";
import { mergeStoreDatabases } from "./mergeStoreDatabases";
import { installSQLite3 } from './install';

export async function restoreCache(key: string, ref?: string) {
    const tempDir = await cacheUtils.createTempDirectory();

    const dbOldBackupPath = `${tempDir}/old.sqlite`;
    const dbNewBackupPath = `${tempDir}/new.sqlite`;
    const dbMergedPath = `${tempDir}/merged.sqlite`;
    
    const user = "runner";
    const group = inputs.choose("runner", "staff", "");
    
    // Need SQLite to checkpoint the database.
    await installSQLite3();
    
    let copyDb = async (dbPath: string) => {
        utils.info("Checkpointing the database.");
            
        await utils.run(
            `sqlite3 "${dbStandardPath}" 'PRAGMA wal_checkpoint(TRUNCATE);'`
        );
        
        utils.info(`Copying "${dbStandardPath}" to "${dbPath}".`);
        
        await utils.run(`
            sudo cp ${dbStandardPath} ${dbPath};
            sudo chown ${user}:${group} ${dbPath}
        `)
    }
    
    if (inputs.nix) {
        await copyDb(dbOldBackupPath)
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
            await copyDb(dbNewBackupPath)

            const mergeScriptPath = `${tempDir}/merge.sql`;
            
            await mergeStoreDatabases(
                mergeScriptPath,
                dbOldBackupPath,
                dbNewBackupPath,
                dbMergedPath,
                dbStandardPath
            );
            
            const nixCachePath = `${process.env.HOME}/.cache/nix`;

            if (existsSync(nixCachePath)) {
                utils.info(
                    `Giving write permissions for ${nixCachePath} to the current user.`
                );
                
                await utils.run(`sudo chmod -R u+w ${nixCachePath}`);
            }
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
