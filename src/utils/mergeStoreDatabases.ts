import { exec } from "@actions/exec";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import Handlebars from "handlebars";

export async function mergeStoreDatabases(
    tempDir: string,
    dbPath1: string,
    dbPath2: string,
    dbPath: string
) {
    if (existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
    const mergeSqlTemplate = readFileSync("src/templates/merge.sql").toString();

    const mergeSqlFile = `${tempDir}/merge.sql`;
    const template = Handlebars.compile(mergeSqlTemplate);
    writeFileSync(mergeSqlFile, template({ dbPath1, dbPath2 }));

    await exec(`sqlite3 ${dbPath} ${mergeSqlFile}`);
}
