import path from "node:path";

import {
  DEFAULT_CAMPAIGNS_ROOT,
  DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR,
  convertAllCampaignProjectsToV2Shadow,
  formatCampaignV2ShadowSummary,
} from "../src/data/campaignV2ShadowConversion.js";

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_CAMPAIGNS_ROOT,
    projectIds: [],
    contentSubdir: DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--project" || arg === "-p") {
      const projectId = argv[index + 1];
      if (!projectId) {
        throw new Error(`${arg} requires a project id.`);
      }
      options.projectIds.push(projectId);
      index += 1;
      continue;
    }

    if (arg === "--root-dir") {
      const rootDir = argv[index + 1];
      if (!rootDir) {
        throw new Error("--root-dir requires a path.");
      }
      options.rootDir = path.resolve(rootDir);
      index += 1;
      continue;
    }

    if (arg === "--content-subdir") {
      const contentSubdir = argv[index + 1];
      if (!contentSubdir) {
        throw new Error("--content-subdir requires a directory name.");
      }
      options.contentSubdir = contentSubdir;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return {
        ...options,
        help: true,
      };
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/generate-campaign-v2-shadow.mjs [options]

Options:
  --project, -p <projectId>     Convert one project. Repeat to convert multiple projects.
  --root-dir <path>             Override the campaigns root.
  --content-subdir <name>       Override the shadow output folder. Default: ${DEFAULT_CAMPAIGN_V2_SHADOW_SUBDIR}
  --dry-run                     Build and validate the shadow dataset without writing files.
  --help, -h                    Show this help text.
`);
}

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const results = convertAllCampaignProjectsToV2Shadow({
    rootDir: options.rootDir,
    projectIds: options.projectIds,
    contentSubdir: options.contentSubdir,
    dryRun: options.dryRun,
  });

  console.log(
    `${options.dryRun ? "Validated" : "Generated"} campaign-v2 shadow data in ${options.rootDir} (${options.contentSubdir}).`,
  );

  for (const result of results) {
    console.log(`- ${formatCampaignV2ShadowSummary(result.summary)}`);
    if (result.summary.warnings.length > 0) {
      for (const warning of result.summary.warnings) {
        console.log(`  warning: ${warning}`);
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
