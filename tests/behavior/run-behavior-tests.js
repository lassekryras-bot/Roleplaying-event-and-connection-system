import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  afterScenario,
  beforeScenario,
  steps,
} from "./steps/thread-visibility.steps.js";

function parseFeature(content) {
  const scenarios = [];
  let currentScenario = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (line.startsWith("Scenario:")) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      currentScenario = {
        name: line.replace("Scenario:", "").trim(),
        steps: [],
      };
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

async function run() {
  const featurePath = path.resolve("tests/behavior/thread-visibility.feature");
  const featureContent = await fs.readFile(featurePath, "utf8");
  const scenarios = parseFeature(featureContent);
  let failed = 0;

  for (const scenario of scenarios) {
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
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${scenario.name}`);
      console.error(`  ${error.stack ?? error.message}`);
    } finally {
      await afterScenario(world);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} behavior scenario(s) failed`);
    process.exit(1);
  }

  console.log(`\n${scenarios.length} behavior scenario(s) passed`);
}

await run();
