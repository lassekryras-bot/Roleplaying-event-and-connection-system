import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { afterScenario, beforeScenario, steps } from "./steps/integration-api.steps.js";

const featureDir = path.resolve("tests/integration/features");
const reportDir = path.resolve("artifacts/integration");

function parseFeature(content) {
  const scenarios = [];
  let feature = "Integration";
  let featureTags = [];
  let pendingTags = [];
  let currentScenario = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("@")) {
      pendingTags.push(...line.split(/\s+/).filter((token) => token.startsWith("@")));
      continue;
    }

    if (line.startsWith("Feature:")) {
      feature = line.replace("Feature:", "").trim();
      featureTags = [...pendingTags];
      pendingTags = [];
      continue;
    }

    if (line.startsWith("Scenario:")) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }

      currentScenario = {
        feature,
        name: line.replace("Scenario:", "").trim(),
        tags: [...new Set([...featureTags, ...pendingTags])],
        steps: [],
      };
      pendingTags = [];
      continue;
    }

    const stepMatch = /^(Given|When|Then|And)\s+(.+)$/.exec(line);
    if (stepMatch && currentScenario) {
      currentScenario.steps.push(stepMatch[2]);
    }
  }

  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return scenarios;
}

function evaluateTagExpression(tags, expression) {
  if (!expression) {
    return true;
  }

  return expression.split(/\s+or\s+/i).some((orChunk) => {
    return orChunk.split(/\s+and\s+/i).every((andChunk) => {
      const token = andChunk.trim().replace(/^\(|\)$/g, "");
      const isNot = token.toLowerCase().startsWith("not ");
      const rawTag = isNot ? token.slice(4).trim() : token;
      const normalizedTag = rawTag.startsWith("@") ? rawTag : `@${rawTag}`;
      const hasTag = tags.includes(normalizedTag);
      return isNot ? !hasTag : hasTag;
    });
  });
}

async function writeReports(results) {
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    path.join(reportDir, "integration-report.json"),
    JSON.stringify({ suite: "integration", testcases: results }, null, 2),
    "utf8",
  );
}

async function run() {
  const entries = await fs.readdir(featureDir, { withFileTypes: true });
  const featureFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".feature"))
    .map((entry) => path.join(featureDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const parsedScenarios = await Promise.all(
    featureFiles.map(async (featurePath) => parseFeature(await fs.readFile(featurePath, "utf8"))),
  );
  const scenarios = parsedScenarios.flat();
  const selectedScenarios = scenarios.filter((scenario) =>
    evaluateTagExpression(scenario.tags, process.env.INTEGRATION_TAGS?.trim()),
  );

  const results = [];

  for (const scenario of selectedScenarios) {
    const startedAt = Date.now();
    const world = {};

    try {
      await beforeScenario(world);

      for (const stepText of scenario.steps) {
        const stepHandler = steps.get(stepText);
        if (!stepHandler) {
          throw new Error(`No step definition found for: "${stepText}"`);
        }

        await stepHandler(world);
      }

      console.log(`ok - ${scenario.name}`);
      results.push({ ...scenario, status: "passed", durationMs: Date.now() - startedAt });
    } catch (error) {
      console.error(`not ok - ${scenario.name}`);
      console.error(`  ${error.stack ?? error.message}`);
      results.push({
        ...scenario,
        status: "failed",
        durationMs: Date.now() - startedAt,
        errorMessage: error.message,
      });
    } finally {
      await afterScenario(world);
    }
  }

  await writeReports(results);

  const failed = results.filter((result) => result.status === "failed").length;
  if (failed > 0) {
    process.exit(1);
  }

  console.log(`\n${results.length} integration scenario(s) passed`);
}

await run();
