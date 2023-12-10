import * as core from "@actions/core";

import { Events, Inputs, Outputs, State } from "./constants";
import * as inputs from "./inputs";
import { IStateProvider } from "./stateProvider";
import * as utils from "./utils/action";
import { restoreCaches, restoreWithKey } from "./utils/restore";

async function restoreImpl(
    stateProvider: IStateProvider
): Promise<string | undefined> {
    try {
        core.setOutput(Outputs.Hit, false);
        core.setOutput(Outputs.HitPrimary, false);
        core.setOutput(Outputs.HitFirstMatch, false);
        core.setOutput(Outputs.RestoredKey, false);
        core.setOutput(Outputs.RestoredKeys, []);

        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        // Validate inputs, this can cause task failure
        if (!utils.isValidEvent()) {
            throw new Error(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
        }

        let restoredKey: string | undefined;
        let lookedUpKey: string | undefined;
        const restoredKeys: string[] = [];

        const errorNot = (message: string) =>
            new Error(
                `
                No cache with the given key ${message}.
                Exiting as the input "${Inputs.FailOn}" is set.
                `
            );

        const errorNotFound = errorNot("was found");
        const errorNotRestored = errorNot("could be restored");

        {
            const primaryKey = inputs.key;
            stateProvider.setState(State.CachePrimaryKey, primaryKey);

            utils.info(`Searching for a cache with the key "${primaryKey}".`);
            lookedUpKey = await utils.getCacheKey({
                primaryKey,
                restoreKeys: [],
                lookupOnly: true
            });

            if (
                !lookedUpKey &&
                inputs.failOn?.keyType == "primary" &&
                inputs.failOn?.result == "miss"
            ) {
                throw errorNotFound;
            }

            if (lookedUpKey && utils.isExactKeyMatch(primaryKey, lookedUpKey)) {
                utils.info(
                    `Found a cache with the given "${Inputs.PrimaryKey}".`
                );
                core.setOutput(Outputs.HitPrimary, true);

                if (!inputs.skipRestoreOnHitPrimaryKey) {
                    restoredKey = await restoreWithKey(primaryKey);
                    if (restoredKey) {
                        restoredKeys.push(...[restoredKey]);
                    } else if (
                        inputs.failOn?.keyType == "primary" &&
                        inputs.failOn?.result == "not-restored"
                    ) {
                        throw errorNotRestored;
                    }
                }
            }
        }

        if (
            !restoredKey &&
            !(inputs.skipRestoreOnHitPrimaryKey && lookedUpKey)
        ) {
            utils.info(
                `
                Searching for a cache using the "${Inputs.PrefixesFirstMatch}":
                
                ${JSON.stringify(inputs.prefixesFirstMatch)}
                `
            );

            const foundKey = await utils.getCacheKey({
                primaryKey: "",
                restoreKeys: inputs.prefixesFirstMatch,
                lookupOnly: true
            });

            if (
                !foundKey &&
                inputs.failOn?.keyType == "first-match" &&
                inputs.failOn.result == "miss"
            ) {
                throw errorNotFound;
            }

            if (foundKey) {
                utils.info(
                    `Found a cache using the "${Inputs.PrefixesFirstMatch}".`
                );
                core.setOutput(Outputs.HitFirstMatch, true);

                restoredKey = await restoreWithKey(foundKey);
                if (restoredKey) {
                    restoredKeys.push(...[restoredKey]);
                } else if (
                    inputs.failOn?.keyType == "first-match" &&
                    inputs.failOn?.result == "not-restored"
                ) {
                    throw errorNotRestored;
                }
            }
        }

        if (!(inputs.skipRestoreOnHitPrimaryKey && lookedUpKey)) {
            restoredKeys.push(...(await restoreCaches()));
        }

        restoredKey ||= "";

        // Store the matched cache key in states
        stateProvider.setState(State.CacheRestoredKey, restoredKey);

        core.setOutput(Outputs.Hit, true);
        core.setOutput(Outputs.RestoredKey, restoredKey);
        core.setOutput(Outputs.RestoredKeys, restoredKeys);

        return restoredKey;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
    }
}

export default restoreImpl;
