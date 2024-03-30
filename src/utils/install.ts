import * as inputs from "../inputs";
import * as utils from "./action";
import { which } from "@actions/io";

export async function installSQLite3() {
    if (inputs.nix && inputs.isMacos) {
        try {
            await which("sqlite3", true);
        } catch (error: unknown) {
            utils.info("No SQLite 3 found. Installing it.");
            await utils.run(`brew install sqlite3`);
        }
    }
}
