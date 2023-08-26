import * as core from "@actions/core";
import { exec } from "@actions/exec";

import * as utils from "./utils/actionUtils";

export enum Inputs {
    GCMacos = "gc-macos", // Input for cache, save action
    GCMaxStoreSizeMacos = "gc-max-store-size-macos", // Input for cache, save action
    GCLinux = "gc-linux", // Input for cache, save action
    GCMaxStoreSizeLinux = "gc-max-store-size-linux" // Input for cache, save action
}

export async function collectGarbage() {
    core.info("Collecting garbage");

    await exec("bash", ["-c", "sudo rm -rf /nix/.[!.]* /nix/..?*"]);

    const gcEnabled = utils.getInputAsBool(
        process.platform == "darwin" ? Inputs.GCMacos : Inputs.GCLinux,
        { required: false }
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
