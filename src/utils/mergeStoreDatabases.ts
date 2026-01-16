import { writeFileSync } from "fs";
import Handlebars from "handlebars";

import { mergeSqlTemplate } from "../templates/merge";
import * as utils from "./action";
import { dbShmStandardPath, dbWalStandardPath } from "./database";

export async function mergeStoreDatabases(
    mergeScriptPath: string,
    dbOldBackupPath: string,
    dbNewBackupPath: string,
    dbMergedPath: string,
    dbStandardPath: string
) {
    utils.info("Merging databases.");
    
    utils.info(`Writing the merge script at ${mergeScriptPath}.`);
    
    const template = Handlebars.compile(mergeSqlTemplate);
    writeFileSync(mergeScriptPath, template({ dbPath1: dbOldBackupPath, dbPath2: dbNewBackupPath }));
    
    utils.info(
        `
        Merging store databases "${dbOldBackupPath}" and "${dbNewBackupPath}"
        into the new database "${dbMergedPath}".
        `
    );

    await utils.run(`sqlite3 ${dbMergedPath} < ${mergeScriptPath}`);
    
    utils.info(`Checking the new database.`);
    
    await utils.run(`sqlite3 "${dbMergedPath}" 'PRAGMA integrity_check;'`);
    
    utils.info(`Removing the old database files.`)
    
    await utils.run(`rm -f ${dbStandardPath} ${dbWalStandardPath} ${dbShmStandardPath}`);
    
    utils.info(`Moving the new database file to ${dbStandardPath}.`)
    
    await utils.run(`mv ${dbMergedPath} ${dbStandardPath}`);    
    
    utils.info(`Finished merging databases.`)
}
