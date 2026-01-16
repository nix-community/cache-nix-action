import { writeFileSync } from "fs";
import Handlebars from "handlebars";

import { mergeSqlTemplate } from "../templates/merge";
import * as utils from "./action";

export async function mergeStoreDatabases(
    mergeScriptPath: string,
    dbOldPath: string,
    dbNewPath: string,
    dbMergedPath: string,
    dbStorePath: string
) {
    utils.info("Checkpointing the old database.");
    
    await utils.run(
        `sqlite3 "${dbStorePath}" 'PRAGMA wal_checkpoint(TRUNCATE);'`
    );
    utils.info(
        `
        Merging store databases "${dbOldPath}" and "${dbNewPath}"
        into the new database "${dbMergedPath}".
        `
    );
    
    const template = Handlebars.compile(mergeSqlTemplate);
    writeFileSync(mergeScriptPath, template({ dbPath1: dbOldPath, dbPath2: dbNewPath }));

    await utils.run(`sqlite3 ${dbMergedPath} < ${mergeScriptPath}`);
    
    utils.info(`Checking the new database.`);
    
    await utils.run(`sqlite3 "${dbMergedPath}" 'PRAGMA integrity_check;'`);
    
    utils.info(`Removing old database files.`)
    
    await utils.run(`sudo rm -f ${dbStorePath} ${dbStorePath}-wal ${dbStorePath}-shm`);
    
    utils.info(`Moving the database file to ${dbStorePath}.`)
    
    await utils.run(`sudo mv ${dbMergedPath} ${dbStorePath}`);    
}
