import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import * as github from "@actions/github";

import { Events, Inputs, State } from "./constants";
import { collectGarbage } from "./gc";
import { purgeCaches } from "./purge";
import { type IStateProvider } from "./stateProvider";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logError(e.message));

async function saveImpl(stateProvider: IStateProvider): Promise<number | void> {
    let cacheId = -1;
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
            stateProvider.getState(State.CachePrimaryKey) ||
            core.getInput(Inputs.Key);

        if (!primaryKey || primaryKey === "") {
            throw new Error(
                `
                Primary cache key not found.
                You may want to specify it in your workflow file.
                See "with.key" field at the step where you use this action.
                `
            );
        }

        const cachePaths = utils.paths;
        const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);

        const restoredKey = await utils.getCacheKey({
            paths: cachePaths,
            primaryKey,
            restoreKeys,
            lookupOnly: true
        });

        const time = Date.now();

        if (utils.isExactKeyMatch(primaryKey, restoredKey)) {
            core.info(`Cache hit occurred on the primary key ${primaryKey}.`);

            const caches = await purgeCaches({
                key: primaryKey,
                lookupOnly: true,
                time
            });

            if (caches.map(cache => cache.key).includes(primaryKey)) {
                core.info(`Purging the cache with the key ${primaryKey}...`);

                const token = core.getInput(Inputs.Token, { required: true });
                const octokit = getOctokit(token);

                octokit.rest.actions.deleteActionsCacheByKey({
                    per_page: 100,
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    key: primaryKey,
                    ref: github.context.ref
                });
            } else {
                core.info(
                    `The cache with the key ${primaryKey} won't be purged. Not saving a new cache.`
                );

                await purgeCaches({ key: primaryKey, lookupOnly: false, time });

                return;
            }
        }

        await collectGarbage();

        core.info(`Saving a new cache with the key ${primaryKey}...`);

        cacheId = await cache.saveCache(cachePaths, primaryKey, {
            uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
        });

        if (cacheId != -1) {
            core.info(`Cache saved with the key ${primaryKey}.`);

            await purgeCaches({ key: primaryKey, lookupOnly: false, time });
        }
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
    return cacheId;
}

export default saveImpl;
