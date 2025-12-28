import { tryOverrideActionsUrl } from "./utils/overrideUrl";
import { saveRun } from "./saveImpl";

tryOverrideActionsUrl();
saveRun(true);
