import * as utils from "./action";

// Adapted from https://github.com/nix-community/cache-nix-action/issues/189
export async function tryOverrideActionsUrl() {
    const customCacheURL = process.env["CUSTOM_ACTIONS_CACHE_URL"];

    if (customCacheURL) {
        utils.info(`Redefining the "ACTIONS_CACHE_URL" to "${customCacheURL}"`);
        process.env["ACTIONS_CACHE_URL"] = customCacheURL;
    }

    const customResultsURL = process.env["CUSTOM_ACTIONS_RESULTS_URL"];

    if (customResultsURL) {
        utils.info(
            `Redefining the "ACTIONS_RESULTS_URL" to "${customResultsURL}"`
        );
        process.env["ACTIONS_RESULTS_URL"] = customResultsURL;
    }
}
