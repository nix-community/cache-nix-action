import { which } from "@actions/io";

import * as inputs from "../inputs";
import * as utils from "./action";

export async function installSQLite3() {
    if (inputs.nix) {
        try {
            await which("sqlite3", true);
        } catch (error: unknown) {
            utils.info(
                `
                No SQLite 3 found.
                
                Trying to install it.
                `
            );

            try {
                utils.info(
                    "Trying to install it using the experimental `nix` command."
                );

                await utils.run(`nix profile install nixpkgs#sqlite`);
            } catch (error: unknown) {
                try {
                    utils.info(
                        "Failed to install it using the experimental `nix` command."
                    );

                    utils.info(
                        "Trying to install it using the `nix-env` command."
                    );

                    await utils.run(`nix-env --install sqlite`);
                } catch (error: unknown) {
                    throw new Error("Could not install SQLite 3.", {
                        cause: error
                    });
                }
            }

            utils.info("Successfully installed SQLite 3!");
        }
    }
}
