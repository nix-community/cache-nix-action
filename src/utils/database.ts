import { which } from "@actions/io";
import * as utils from "./action";
import * as inputs from "../inputs";

export const dbStandardPath = "/nix/var/nix/db/db.sqlite";
export const dbWalStandardPath = `${dbStandardPath}-wal`;
export const dbShmStandardPath = `${dbStandardPath}-shm`;

const user = "runner";
const group = inputs.choose("runner", "staff", "");

async function makeWritable(path: string) {
    await utils.run(
        `sudo test -f ${path} && sudo chown ${user}:${group} ${path} && sudo chmod +rw ${path} || echo "${path} doesn't exist"`
    );
}

export async function updateDbPermissions() {
    utils.info("Updating the database files' permissions.");

    await makeWritable(dbStandardPath);
    await makeWritable(dbWalStandardPath);
    await makeWritable(dbShmStandardPath);
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

    await utils.run(`sudo cp -p ${dbStandardPath} ${dbPath}`);
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
