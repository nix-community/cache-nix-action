import * as core from "@actions/core";

import { Events, Inputs, Outputs, State } from "./constants";
import * as inputs from "./inputs";
import {
    IStateProvider,
    NullStateProvider,
    StateProvider
} from "./stateProvider";
import * as utils from "./utils/action";
import * as install from "./utils/install";
import * as restore from "./utils/restore";

export async function restoreImpl(
    stateProvider: IStateProvider,
    earlyExit?: boolean | undefined
): Promise<string | undefined> {
    try {
        if (!utils.isCacheFeatureAvailable()) {
            return;
        }

        // Validate inputs, this can cause task failure
        if (!utils.isValidEvent()) {
            utils.logWarning(
                `Event Validation Error: The event type ${
                    process.env[Events.Key]
                } is not supported because it's not tied to a branch or tag ref.`
            );
        }

        await install.installSQLite3();

        let restoredKey: string | undefined;
        let lookedUpPrimaryKey: string | undefined;
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

        let hitPrimaryKey = false;

        {
            const primaryKey = inputs.primaryKey;
            stateProvider.setState(State.CachePrimaryKey, primaryKey);

            utils.info(`Searching for a cache with the key "${primaryKey}".`);
            lookedUpPrimaryKey = await utils.restoreCache({
                primaryKey,
                restoreKeys: [],
                lookupOnly: true
            });

            if (!lookedUpPrimaryKey) {
                if (
                    inputs.failOn?.keyType == "primary" &&
                    inputs.failOn?.result == "miss"
                ) {
                    throw errorNotFound;
                } else {
                    utils.info(
                        `Could not find a cache with the given "${Inputs.PrimaryKey}" and "${Inputs.Paths}".`
                    );
                }
            } else if (utils.isExactKeyMatch(primaryKey, lookedUpPrimaryKey)) {
                utils.info(
                    `Found a cache with the given "${Inputs.PrimaryKey}".`
                );
                hitPrimaryKey = true;

                if (!inputs.skipRestoreOnHitPrimaryKey) {
                    restoredKey = await restore.restoreCache(primaryKey);
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

        let hitFirstMatch = false;

        if (
            inputs.restorePrefixesFirstMatch.length > 0 &&
            // We may have got an unexpected primary key match by prefix.
            !hitPrimaryKey
        ) {
            utils.info(
                `
                Searching for a cache using the "${
                    Inputs.RestorePrefixesFirstMatch
                }":
                ${JSON.stringify(inputs.restorePrefixesFirstMatch)}
                `
            );

            const lookedUpFirstMatch = await utils.restoreCache({
                primaryKey:
                    "dummy-primary-key-9238748923658961076458761340578645781643059823761298348927349233",
                restoreKeys: inputs.restorePrefixesFirstMatch,
                lookupOnly: true
            });

            if (!lookedUpFirstMatch) {
                if (
                    inputs.failOn?.keyType == "first-match" &&
                    inputs.failOn.result == "miss"
                ) {
                    throw errorNotFound;
                } else {
                    utils.info(`Could not find a cache.`);
                }
            } else {
                utils.info(
                    `Found a cache using the "${Inputs.RestorePrefixesFirstMatch}".`
                );
                hitFirstMatch = true;

                restoredKey = await restore.restoreCache(lookedUpFirstMatch);
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

        if (!lookedUpPrimaryKey) {
            restoredKeys.push(...(await restore.restoreAllMatches()));
        }

        restoredKey ??= "";

        // Store the matched cache key in states
        stateProvider.setState(State.CacheRestoredKey, restoredKey);

        core.setOutput(Outputs.HitPrimaryKey, hitPrimaryKey);
        core.setOutput(Outputs.HitFirstMatch, hitFirstMatch);
        core.setOutput(Outputs.Hit, hitPrimaryKey || hitFirstMatch);
        core.setOutput(Outputs.RestoredKey, restoredKey);
        core.setOutput(Outputs.RestoredKeys, restoredKeys);

        return restoredKey;
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
        if (earlyExit) {
            process.exit(1);
        }
    }
}

async function withDisabledNixDaemon<T>(f: Promise<T>): Promise<T> {
    if (inputs.nix) {
        utils.info(
            `
            Trying to disable 'nix-daemon' 
            so that it doesn't corrupt the database
            while restoring the cache.
            `
        );

        await utils.run(
            inputs.choose(
                "sudo systemctl stop nix-daemon.service",
                "sudo launchctl unload /Library/LaunchDaemons/org.nixos.nix-daemon.plist",
                ""
            )
        );
    }

    let result = await f;

    if (inputs.nix) {
        utils.info("Trying to enable 'nix-daemon'.");

        await utils.run(
            inputs.choose(
                "sudo systemctl start nix-daemon.service",
                "sudo launchctl load /Library/LaunchDaemons/org.nixos.nix-daemon.plist",
                ""
            )
        );
    }

    return result;
}

async function run(
    stateProvider: IStateProvider,
    earlyExit: boolean | undefined
): Promise<void> {
    await withDisabledNixDaemon(restoreImpl(stateProvider, earlyExit));

    // node will stay alive if any promises are not resolved,
    // which is a possibility if HTTP requests are dangling
    // due to retries or timeouts. We know that if we got here
    // that all promises that we care about have successfully
    // resolved, so simply exit with success.
    if (earlyExit) {
        process.exit(0);
    }
}

export async function restoreOnlyRun(
    earlyExit?: boolean | undefined
): Promise<void> {
    await run(new NullStateProvider(), earlyExit);
}

export async function restoreRun(
    earlyExit?: boolean | undefined
): Promise<void> {
    await run(new StateProvider(), earlyExit);
}
