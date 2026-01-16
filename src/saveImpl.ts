import * as core from "@actions/core";
import * as fs from "fs";

import { dbStandardPath, Events, Inputs, State } from "./constants";
import * as inputs from "./inputs";
import {
    IStateProvider,
    NullStateProvider,
    StateProvider
} from "./stateProvider";
import * as utils from "./utils/action";
import { cache } from "./utils/cacheBackend";
import { collectGarbage } from "./utils/collectGarbage";
import { purgeCacheByKey, purgeCaches } from "./utils/purge";
import { installSQLite3 } from "./utils/install";
import { TarCommandModifiers } from "actions/toolkit/packages/cache/src/options";
import { Temporal } from "temporal-polyfill";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

export async function saveImpl(
    stateProvider: IStateProvider
): Promise<number | void> {
    let cacheId = -1;
    const time = Temporal.Now.zonedDateTimeISO("UTC");
    try {
        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
            return;
        }

        // If restore has stored a primary key in state, reuse that
        // Else re-evaluate from inputs
        const primaryKey =
            stateProvider.getState(State.CachePrimaryKey) || inputs.primaryKey;

        if (inputs.save) {
            utils.info(
                `Trying to save a new cache with the key "${primaryKey}".`
            );
        }

        if (inputs.purge) {
            if (inputs.purgePrimaryKey == "always") {
                await purgeCacheByKey(
                    primaryKey,
                    `Purging the cache with the key "${primaryKey}" because of "${Inputs.PurgePrimaryKey}: always".`
                );
            } else {
                // We try to purge the cache by the primary key
                // to potentially save a new cache with that key
                await purgeCaches({
                    primaryKey,
                    prefixes: [],
                    time
                });
            }
        }

        // Save a cache using the primary key
        if (!inputs.save) {
            `Not saving a new cache because of "${Inputs.Save}: false"`;
        } else {
            utils.info(`Searching for a cache with the key "${primaryKey}".`);

            const lookedUpPrimaryKey = await utils.restoreCache({
                primaryKey,
                restoreKeys: [],
                lookupOnly: true
            });

            if (utils.isExactKeyMatch(primaryKey, lookedUpPrimaryKey)) {
                utils.info(
                    `
                    Cache hit occurred on the "${Inputs.PrimaryKey}".
                    Not collecting garbage.
                    Not saving a new cache.
                    `
                );

                // Since we don't save a cache
                // it's probably safe to set the value
                // to something other than -1
                // so that the warning
                // in the try block in saveOnlyRun
                // is not printed
                cacheId = 0;
            } else {
                utils.info(`Found no cache with this key.`);

                await collectGarbage();

                utils.info(`Saving a new cache with the key "${primaryKey}".`);

                // Checkpoint WAL before saving to ensure all data is in the DB.
                if (inputs.nix) {
                    await installSQLite3();
                    
                    utils.info("Checkpointing SQLite WAL.");
                    await utils.run(
                        `sqlite3 ${dbStandardPath} 'PRAGMA wal_checkpoint(TRUNCATE);'`
                    );
                }

                let tarCommandModifiers = new TarCommandModifiers();

                tarCommandModifiers.createArgs =
                    await utils.prepareExcludeFromFile(false);

                // can throw
                cacheId = await cache.saveCache(
                    inputs.paths,
                    primaryKey,
                    {
                        uploadChunkSize: inputs.uploadChunkSize
                    },
                    undefined,
                    tarCommandModifiers
                );

                utils.info(
                    cacheId !== -1
                        ? `Saved the new cache.`
                        : `Could not save the new cache.`
                );

                if (core.isDebug()) {
                    core.debug("\n\nNix store paths:\n\n");

                    fs.readdirSync("/nix/store").forEach(file => {
                        core.debug(file);
                    });
                }
            }
        }

        // Purge other caches
        if (inputs.purge) {
            await purgeCaches({
                primaryKey,
                prefixes: inputs.purgePrefixes,
                time
            });
        }
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
    return cacheId;
}

export async function saveOnlyRun(
    earlyExit?: boolean | undefined
): Promise<void> {
    try {
        const cacheId = await saveImpl(new NullStateProvider());
        if (cacheId === -1) {
            core.warning(`Cache save failed.`);
        }
    } catch (err) {
        console.error(err);
        if (earlyExit) {
            process.exit(1);
        }
    }

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    if (earlyExit) {
        process.exit(0);
    }
}

export async function saveRun(earlyExit?: boolean | undefined): Promise<void> {
    try {
        await saveImpl(new StateProvider());
    } catch (err) {
        console.error(err);
        if (earlyExit) {
            process.exit(1);
        }
    }

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    if (earlyExit) {
        process.exit(0);
    }
}
