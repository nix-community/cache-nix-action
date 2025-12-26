## Hypotheses

1. daemon notices changes in some time, fails, and corrupts the database

## What to do

1. TODO: Extract from tar immediately to root:root.
    - Option 1: <https://superuser.com/a/1782608>
2. Try to stop nix-daemon
    - Linux, macOS: <https://nix.dev/manual/nix/2.33/installation/uninstall>
3. Check integrity after moving the database, not after creation.

## Done

1. Compare sqls - after install and after restore non-corrupted
    - Result: they pretty much match
1. Try to replace the database
   1. Back up database (non-corrupted) right after restore
   2. then reproduce corruption
   3. then replace the database with the backed-up version
   4. I expect it to get corrupted after the first command
2. Don't cache `.cache`