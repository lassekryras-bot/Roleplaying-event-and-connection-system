import path from "node:path";

import { ensureSeedCampaignFiles } from "../src/data/fileCampaignStore.js";

const rootDir = path.join(process.cwd(), "campaigns");

ensureSeedCampaignFiles(rootDir);

console.log(`Seeded canonical campaign files in ${rootDir}`);
