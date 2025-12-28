import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

export async function collectGarbage() {
    utils.info("Removing useless files.");

    await utils.run(`sudo rm -rf /nix/.[!.]* /nix/..?*`);

    utils.info("Calculating store size.");

    async function getStoreSize() {
        const { stdout } = await utils.run(`
            nix \
                --experimental-features nix-command \
                path-info --json --json-format 2 --all \
                | jq '.info | map(.narSize) | add'
        `);

        const storeSize = (() => {
            try {
                return BigInt(stdout);
            } catch (err) {
                let sizeDummy = 1_000_000_000_000n;
                utils.warning(
                    `
                    Expected a number as the store size, but got: ${stdout}.
                    
                    Assuming the store has size: ${sizeDummy}.
                    `
                );
                return sizeDummy;
            }
        })();

        utils.info(`Current store size in bytes: ${storeSize}.`);

        return storeSize;
    }

    const storeSize = await getStoreSize();

    if (inputs.gcMaxStoreSize === undefined) {
        utils.info(
            `Not collecting garbage because none of "${Inputs.GCMaxStoreSize}", "${inputs.gcMaxStoreSizeInputName}" are specified.`
        );
    } else {
        utils.info(
            `Maximum allowed store size in bytes: ${inputs.gcMaxStoreSize.value} (${inputs.gcMaxStoreSize.input}).`
        );

        if (storeSize <= inputs.gcMaxStoreSize.value) {
            utils.info("No garbage to collect.");
            return;
        } else {
            utils.info("Collecting garbage.");
        }

        const maxBytesToFree = storeSize - inputs.gcMaxStoreSize.value;

        utils.info(`Max bytes to free: ${maxBytesToFree}.`);

        utils.info(`::group::Logs produced while collecting garbage.`);

        await utils.run(`nix --experimental-features nix-command store gc --max ${maxBytesToFree}`, true);

        utils.info(`::endgroup::`);

        utils.info(`Finished collecting garbage.`);

        await getStoreSize();
    }
}
