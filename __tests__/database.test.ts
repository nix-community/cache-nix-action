import { execFileSync } from "child_process";

import * as utils from "../src/utils/action";
import { updateDbPermissions } from "../src/utils/database";

jest.mock("../src/utils/action", () => ({
    info: jest.fn(),
    run: jest.fn()
}));
jest.mock("../src/inputs", () => ({}));

test.each([
    [1001, 1002],
    [501, 20],
    [0, 0]
])("database ownership uses the invoking UID %i and GID %i", async (uid, gid) => {
    jest.mocked(utils.run).mockImplementation(command => {
        // Execute the generated shell command, replacing privileged operations
        // with argument recording. No real ownership or permissions are changed.
        const stdout = execFileSync(
            "bash",
            [
                "-c",
                `id() { case "$1" in -u) echo ${uid} ;; -g) echo ${gid} ;; *) return 1 ;; esac; }
                 sudo() { "$@"; }
                 chown() { printf '%s\n' chown "$@"; }
                 chmod() { printf '%s\n' chmod "$@"; }
                 ${command}`
            ],
            { encoding: "utf8" }
        );
        expect(stdout.trim().split("\n")).toEqual([
            "chown",
            "-R",
            `${uid}:${gid}`,
            "/nix/var/nix/db",
            "chmod",
            "-R",
            "u+rw",
            "/nix/var/nix/db"
        ]);
        return Promise.resolve({ stdout, stderr: "", result: 0 });
    });

    await updateDbPermissions();
    expect(utils.run).toHaveBeenCalledTimes(1);
});
