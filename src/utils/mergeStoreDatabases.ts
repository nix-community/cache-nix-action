import { existsSync, unlinkSync, writeFileSync } from "fs";
import Handlebars from "handlebars";

import { mergeSqlTemplate } from "../templates/merge";
import * as utils from "./action";

export async function mergeStoreDatabases(
    tempDir: string,
    dbPath1: string,
    dbPath2: string,
    dbPath3: string,
    dbPath: string
) {
    if (existsSync(dbPath)) {
        await utils.run(`sudo rm -f ${dbPath}`)
    }

    const mergeSqlFile = `${tempDir}/merge.sql`;
    const template = Handlebars.compile(mergeSqlTemplate);
    writeFileSync(mergeSqlFile, template({ dbPath1, dbPath2 }));

    await utils.run(`sqlite3 ${dbPath3} < ${mergeSqlFile}`);
    
    utils.info(`Checking the new database.`);
    
    await utils.run(`sqlite3 "${dbPath3}" 'PRAGMA integrity_check;'`);
    
    utils.info(`The new database is consistent.`)
    
    await utils.run(`sudo mv ${dbPath3} ${dbPath}`);
    
    utils.info(`Moved the new database to ${dbPath}.`)
}
