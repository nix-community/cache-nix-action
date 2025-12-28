import { tryOverrideActionsUrl } from "./utils/overrideUrl";
import { restoreRun } from "./restoreImpl";

tryOverrideActionsUrl();
restoreRun(true);
