import path from "node:path";

import {
  DEFAULT_CAMPAIGNS_ROOT,
  formatCampaignV2ValidationReport,
  formatCampaignV2ValidationSummary,
  validateCampaignV2Projects,
} from "../src/data/campaignV2MigrationReport.js";

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_CAMPAIGNS_ROOT,
    projectIds: [],
    contentSubdir: null,
    json: false,
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

    if (arg === "--json") {
      options.json = true;
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
  console.log(`Usage: node scripts/validate-campaign-v2.mjs [options]

Options:
  --project, -p <projectId>     Validate one project. Repeat to validate multiple projects.
  --root-dir <path>             Override the campaigns root. Default: ${DEFAULT_CAMPAIGNS_ROOT}
  --content-subdir <name>       Force a specific v2 content folder such as campaign-v2 or campaign-v2-shadow.
  --json                        Print the report as JSON instead of human-readable text.
  --help, -h                    Show this help text.
`);
}

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const reports = validateCampaignV2Projects({
    rootDir: options.rootDir,
    projectIds: options.projectIds,
    contentSubdir: options.contentSubdir,
  });

  if (options.json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const [index, report] of reports.entries()) {
      if (index > 0) {
        console.log("");
      }

      console.log(formatCampaignV2ValidationReport(report));
    }

    console.log("");
    console.log(formatCampaignV2ValidationSummary(reports));
  }

  if (reports.some((report) => report.status === "fail")) {
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
