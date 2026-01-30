import { Inputs } from "../constants";
import * as inputs from "../inputs";
import * as utils from "./action";

interface NixVersion {
    major: number;
    minor: number;
}

function parseNixVersion(nixVersionStdout: string): NixVersion | undefined {
    const regexMajorMinor = /(\d+)\.(\d+)/;

    const match = nixVersionStdout.match(regexMajorMinor);

    if (match) {
        return {
            major: parseInt(match[1], 10),
            minor: parseInt(match[2], 10)
        };
    }

    return undefined;
}

export async function collectGarbage() {
    utils.info("Removing useless files.");

    await utils.run(`sudo rm -rf /nix/.[!.]* /nix/..?*`);

    utils.info("Calculating store size.");

    async function getStoreSize() {
        const nixVersionResult = await utils.run(`nix --version`);

        let nixVersion = parseNixVersion(nixVersionResult.stdout);

        if (nixVersion === undefined) {
            utils.warning(
                `Could not get Nix version ('nix --version'). Got: ${nixVersionResult}.`
            );
            // We select commands based on the Nix version.
            // Currently, we need to differentiate between
            // >=2.33 versions and <2.33 versions.
            // Versions after 2.33 definitely support `nix --version`.
            // Therefore, let's assume the version is 2.0.
            nixVersion = { major: 2, minor: 0 };
        }

        const nixCommand =
            nixVersion.minor >= 33
                ? `nix --experimental-features nix-command path-info --json --json-format 2 --all | jq '.info | map(.narSize) | add'`
                : `nix --experimental-features nix-command path-info --json --all | jq 'map(.narSize) | add'`;

        const nixCommandOutput = await utils.run(nixCommand);

        const storeSize = (() => {
            try {
                return BigInt(nixCommandOutput.stdout);
            } catch (err) {
                let sizeDummy = 1_000_000_000_000n;
                utils.warning(
                    `
                    Expected a number for the store size, but got: ${nixCommandOutput.stdout}.
                    
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

        await utils.run(
            `nix --experimental-features nix-command store gc --max ${maxBytesToFree}`,
            true
        );

        utils.info(`::endgroup::`);

        utils.info(`Finished collecting garbage.`);

        await getStoreSize();
    }
}
