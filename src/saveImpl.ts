import * as cache from "@actions/cache/src/cache";
import * as core from "@actions/core";

import { Events, Inputs, State } from "./constants";
import * as inputs from "./inputs";
import { type IStateProvider } from "./stateProvider";
import * as utils from "./utils/action";
import { removeGarbage } from "./utils/collectGarbage";
import { purgeCacheByKey, purgeCachesByTime } from "./utils/purge";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logError(e.message));

async function saveImpl(stateProvider: IStateProvider): Promise<number | void> {
    const cacheId = -1;
    const time = Date.now();
    try {
        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        if (!utils.isValidEvent()) {
            throw new Error(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
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
                await purgeCachesByTime({
                    primaryKey,
                    time,
                    prefixes: []
                });
            }
        }

        // Save a cache using the primary key
        if (!inputs.save) {
            `Not saving a new cache because of "${Inputs.Save}: false"`;
        } else {
            utils.info(`Searching for a cache with the key "${primaryKey}".`);

            const foundKey = await utils.restoreCache({
                primaryKey,
                restoreKeys: [],
                lookupOnly: true
            });

            if (utils.isExactKeyMatch(primaryKey, foundKey)) {
                utils.info(
                    `
                    Cache hit occurred on the "${Inputs.PrimaryKey}".
                    Not saving a new cache.
                    `
                );
            } else {
                utils.info(`Found no cache with this key.`);

                await removeGarbage();

                utils.info(`Saving a new cache with the key "${primaryKey}".`);

                // can throw
                await cache.saveCache(inputs.paths, primaryKey, {
                    uploadChunkSize: inputs.uploadChunkSize
                });

                utils.info(`Saved a new cache.`);
            }
        }

        // Purge other caches
        if (inputs.purge) {
            await purgeCachesByTime({
                primaryKey,
                time,
                prefixes: inputs.purgePrefixes
            });
        }
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
    return cacheId;
}

export default saveImpl;
