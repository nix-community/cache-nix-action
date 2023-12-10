import { exec } from "@actions/exec";

import * as inputs from "../inputs";
import * as utils from "./action";

export async function collectGarbage() {
    if (inputs.gcMaxStoreSize) {
        utils.info("Collecting garbage.");

        const printStoreSize = `
            STORE_SIZE="$(nix path-info --json --all | jq 'map(.narSize) | add')"    
            printf "Current store size in bytes: $STORE_SIZE\\n"
            `;
        await exec("bash", [
            "-c",
            `
            sudo rm -rf /nix/.[!.]* /nix/..?*

            ${printStoreSize}

            MAX_STORE_SIZE=${inputs.gcMaxStoreSize}
            
            if (( STORE_SIZE > MAX_STORE_SIZE )); then
                (( R1 = STORE_SIZE - MAX_STORE_SIZE ))
                (( R2 = R1 > 0 ? R1 : 0 ))
                printf "Max bytes to free: $R2\\n"
                nix store gc --max "$R2"
            fi
            `
        ]);

        utils.info(
            `
            Finished collecting garbage.

            Calculating the new store size.
            `
        );

        await exec("bash", ["-c", printStoreSize]);
    }
}
