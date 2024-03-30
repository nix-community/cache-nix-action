import { which } from "which";
import * as inputs from "../inputs";
import { exec } from "@actions/exec";
import * as utils from "./action";

export async function installSQLite3() {
    if (inputs.nix) {
        const existsSqlite3 = await which("sqlite3");
        if (!existsSqlite3) {
            utils.info("No SQLite 3 found. Installing it.");
            exec(`brew install sqlite3`);
        }
    }
}
