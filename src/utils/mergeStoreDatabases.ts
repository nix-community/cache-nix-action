import { existsSync, unlinkSync, writeFileSync } from "fs";
import Handlebars from "handlebars";

import { mergeSqlTemplate } from "../templates/merge";
import * as utils from "./action";

export async function mergeStoreDatabases(
    tempDir: string,
    dbOldPath: string,
    dbNewPath: string,
    dbMergedPath: string,
    dbStorePath: string
) {
    if (existsSync(dbStorePath)) {
        await utils.run(`sudo rm -f ${dbStorePath}`);
    }

    const mergeSqlFile = `${tempDir}/merge.sql`;
    const template = Handlebars.compile(mergeSqlTemplate);
    writeFileSync(mergeSqlFile, template({ dbPath1: dbOldPath, dbPath2: dbNewPath }));

    await utils.run(`sqlite3 ${dbMergedPath} < ${mergeSqlFile}`);
    
    utils.info(`Checking the new database.`);
    
    await utils.run(`sqlite3 "${dbMergedPath}" 'PRAGMA integrity_check;'`);
    
    utils.info(`The new database is consistent.`)
    
    await utils.run(`sudo mv ${dbMergedPath} ${dbStorePath}`);
    
    utils.info(`Moved the new database to ${dbStorePath}.`)
}
