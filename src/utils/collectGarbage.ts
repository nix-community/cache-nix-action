import * as inputs from "../inputs";
import * as utils from "./action";

export async function collectGarbage() {
    utils.info("Removing useless files.");

    await utils.run(`sudo rm -rf /nix/.[!.]* /nix/..?*`);

    utils.info("Calculating store size.");

    async function getStoreSize() {
        const { stdout } = await utils.run(
            `nix path-info --json --all | jq 'map(.narSize) | add'`
        );

        const storeSize = parseInt(stdout);

        utils.info(`Current store size in bytes: ${storeSize}.`);

        return storeSize;
    }

    const storeSize = await getStoreSize();

    if (inputs.gcMaxStoreSize) {
        utils.info(
            `Maximum allowed store size in bytes: ${inputs.gcMaxStoreSize}.`
        );

        if (storeSize <= inputs.gcMaxStoreSize) {
            utils.info("No garbage to collect.");
            return;
        } else {
            utils.info("Collecting garbage.");
        }

        const maxBytesToFree = storeSize - inputs.gcMaxStoreSize;

        utils.info(`Max bytes to free: ${maxBytesToFree}.`);

        await utils.run(`nix store gc --max ${maxBytesToFree}`);

        utils.info(`Finished collecting garbage.`);

        await getStoreSize();
    }
}
