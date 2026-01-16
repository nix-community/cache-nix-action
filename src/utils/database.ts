import { which } from "@actions/io";
import * as utils from "./action";
import * as inputs from "../inputs";

export const dbStandardPath = "/nix/var/nix/db/db.sqlite";
export const dbWalStandardPath = `${dbStandardPath}-wal`;
export const dbShmStandardPath = `${dbStandardPath}-shm`;

const user = "runner";
const group = inputs.choose("runner", "staff", "");

export async function updateDbPermissions() {
    utils.info("Updating the database permissions.");

    await utils.run(
        `sudo chown ${user}:${group} ${dbStandardPath} ${dbWalStandardPath} ${dbShmStandardPath} 2> /dev/null || true`
    );
}

export async function copyDb(dbPath: string) {
    await updateDbPermissions();

    utils.info("Checkpointing the database.");

    await utils.run(
        `sqlite3 "${dbStandardPath}" 'PRAGMA wal_checkpoint(TRUNCATE);'`
    );

    utils.info(`Copying the database.`);

    await utils.run(`sudo cp -p ${dbStandardPath} ${dbPath};`);
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
