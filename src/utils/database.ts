import { which } from "@actions/io";
import * as utils from "./action";
import * as inputs from "../inputs";

export const dbStandardDir = "/nix/var/nix/db";
export const dbStandardPath = `${dbStandardDir}/db.sqlite`;
export const dbWalStandardPath = `${dbStandardPath}-wal`;
export const dbShmStandardPath = `${dbStandardPath}-shm`;

const user = "runner";
const group = inputs.choose("runner", "staff", "");

export async function updateDbPermissions() {
    utils.info("Updating the database files' permissions.");

    await utils.run(
        `sudo chown -R ${user}:${group} ${dbStandardDir} && sudo chmod -R u+rw ${dbStandardDir}`
    );
}

export async function checkpointDb() {
    await updateDbPermissions();

    utils.info("Checkpointing the database.");

    await utils.run(
        `sqlite3 "${dbStandardPath}" 'PRAGMA wal_checkpoint(TRUNCATE);'`
    );
}

export async function copyDb(dbPath: string) {
    await checkpointDb();

    utils.info("Copying database.");

    await utils.run(`cp -p ${dbStandardPath} ${dbPath}`);
}

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
