import { exec } from "@actions/exec";

import { Inputs } from "./constants";
import * as utils from "./utils/actionUtils";

export async function collectGarbage() {
    utils.info("Collecting garbage");

    await exec("bash", ["-c", "sudo rm -rf /nix/.[!.]* /nix/..?*"]);

    const gcEnabled = utils.getInputAsBool(
        process.platform == "darwin" ? Inputs.GCMacos : Inputs.GCLinux
    );

    if (gcEnabled) {
        const maxStoreSize = utils.getInputAsInt(
            process.platform == "darwin"
                ? Inputs.GCMaxStoreSizeMacos
                : Inputs.GCMaxStoreSizeLinux,
            { required: true }
        );

        await exec("bash", [
            "-c",
            `
                STORE_SIZE="$(nix path-info --json --all | jq 'map(.narSize) | add')"
                printf "Current store size in bytes: $STORE_SIZE\\n"

                MAX_STORE_SIZE=${maxStoreSize}
                
                if (( STORE_SIZE > MAX_STORE_SIZE )); then
                    (( R1 = STORE_SIZE - MAX_STORE_SIZE ))
                    (( R2 = R1 > 0 ? R1 : 0 ))
                    printf "Max bytes to free: $R2\\n"
                    nix store gc --max "$R2"
                fi
                `
        ]);
    }
}
