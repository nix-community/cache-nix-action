import sqlite3 from "better-sqlite3";
import { existsSync, readFileSync, unlinkSync } from "fs";
import Handlebars from "handlebars";

export function mergeStoreDatabases(
    dbPath1: string,
    dbPath2: string,
    dbPath: string
) {
    if (existsSync(dbPath)) {
        unlinkSync(dbPath);
    }
    const db = new sqlite3(dbPath);
    const mergeSql = readFileSync("src/templates/merge.sql").toString();
    const template = Handlebars.compile(mergeSql);
    db.exec(template({ dbPath1, dbPath2 }));
}
