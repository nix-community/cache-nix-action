import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { exec } from "@actions/exec";

import { Events, Inputs, State } from "./constants";
import { type IStateProvider } from "./stateProvider";
import * as utils from "./utils/actionUtils";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function saveImpl(stateProvider: IStateProvider): Promise<number | void> {
    let cacheId = -1;
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
            stateProvider.getState(State.CachePrimaryKey) ||
            core.getInput(Inputs.Key);

        if (!primaryKey) {
            utils.logWarning(`Key is not specified.`);
            return;
        }

        // If matched restore key is same as primary key, then do not save cache
        // NO-OP in case of SaveOnly action
        const restoredKey = stateProvider.getCacheState();

        if (utils.isExactKeyMatch(primaryKey, restoredKey)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;
        }

        const cachePaths = utils.getInputAsArray(Inputs.Path, {
            required: false
        });

        cachePaths.push(...utils.paths);

        const enableCrossOsArchive = utils.getInputAsBool(
            Inputs.EnableCrossOsArchive
        );

        await exec("bash", ["-c", "sudo rm -rf /nix/.[!.]* /nix/..?*"]);

        const gcEnabled = utils.getInputAsBool(
            process.platform == "darwin"
                ? Inputs.MacosGCEnabled
                : Inputs.LinuxGCEnabled,
            { required: false }
        );

        if (gcEnabled) {
            const maxStoreSize = utils.getInputAsInt(
                process.platform == "darwin"
                    ? Inputs.MacosMaxStoreSize
                    : Inputs.LinuxMaxStoreSize,
                { required: true }
            );

            await exec("bash", [
                "-c",
                `
                STORE_SIZE="$(nix path-info --json --all | jq 'map(.narSize) | add')"
                printf "$STORE_SIZE"

                MAX_STORE_SIZE=${maxStoreSize}
                
                if (( STORE_SIZE > MAX_STORE_SIZE )); then
                    (( R1 = STORE_SIZE - MAX_STORE_SIZE ))
                    (( R2 = R1 > 0 ? R1 : 0 ))
                    nix store gc --max "$R2"
                fi
                `
            ]);
        }

        cacheId = await cache.saveCache(
            cachePaths,
            primaryKey,
            {
                uploadChunkSize: utils.getInputAsInt(Inputs.UploadChunkSize)
            },
            enableCrossOsArchive
        );

        if (cacheId != -1) {
            core.info(`Cache saved with key: ${primaryKey}`);
        }
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
    return cacheId;
}

export default saveImpl;
