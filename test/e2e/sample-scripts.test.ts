import {
  assertPathChanged,
  assertPathNotChanged,
  joinLines,
  runCommand,
} from "../test-util/test-util";
import { join } from "path";
import { modifyJsonProperty } from "./e2e-common";
import { getDebugPath } from "../../src/util/util";

const sampleDir = "sample-scripts";
const targetLngs = ["es", "zh", "de"];
const sourcePath = join(sampleDir, "en", "fruits.json");
const cachePath = join(
  sampleDir,
  "translate-cache",
  "attranslate-cache-en_fruits.json.json"
);

function getTargetPaths(): string[] {
  return targetLngs.map((targetLng) => {
    return join(sampleDir, targetLng, "fruits.json");
  });
}

async function runSampleScript(
  command: string,
  expectModified?: boolean
): Promise<string> {
  const output = await runCommand(command, sampleDir);
  if (expectModified) {
    await assertPathChanged(sampleDir);
    await runCommand(`git checkout ${sampleDir}`);
  } else {
    await assertPathNotChanged(sampleDir);
  }
  return output;
}

test("simple_translate", async () => {
  const output = await runSampleScript(`./simple_translate.sh`);
  expect(output).toBe("Target is up-to-date.\n");
});

test("multi_translate clean", async () => {
  const output = await runSampleScript(`./multi_translate.sh`);
  expect(output).toBe(
    joinLines([
      "Target is up-to-date.",
      "Target is up-to-date.",
      "Target is up-to-date.",
    ])
  );
});

test("multi_translate create new cache", async () => {
  await runCommand(`rm ${cachePath}`);

  const targetPaths = getTargetPaths();
  const expectOutput = getExpectedCreateOutput({
    targetPaths,
    cachePath,
  });
  const output = await runSampleScript(`./multi_translate.sh`);
  expect(output).toBe(expectOutput);
});

function getExpectedCreateOutput(args: {
  targetPaths: string[];
  cachePath: string;
}): string {
  const lines: string[] = [];
  args.targetPaths.forEach((targetPath, index) => {
    if (index === 0) {
      lines.push(
        ...[
          `Cache not found -> Generate a new cache to enable selective translations.`,
          `To make selective translations, do one of the following:`,
          "Option 1: Change your source-file and then re-run this tool.",
          "Option 2: Delete parts of your target-file and then re-run this tool.",
          "Skipped translations because we had to generate a new cache.",
        ]
      );
    } else {
      lines.push(...["Target is up-to-date."]);
    }
    lines.push(`Write cache ${getDebugPath(args.cachePath)}`);
  });
  return joinLines(lines);
}

test("multi_translate propagate updates to null-targets", async () => {
  const targetPaths = getTargetPaths();
  targetPaths.forEach((targetPath) => {
    modifyJsonProperty({
      jsonPath: targetPath,
      index: 0,
      newValue: null,
    });
  });

  const expectOutput = getExpectedUpdateOutput({
    targetPaths,
    cachePath,
    bypassEmpty: false,
  });
  const output = await runSampleScript(`./multi_translate.sh`);
  expect(output).toBe(expectOutput);
});

test("multi_translate propagate empty string from source", async () => {
  const targetPaths = getTargetPaths();

  targetPaths.forEach((targetPath) => {
    modifyJsonProperty({
      jsonPath: sourcePath,
      index: 0,
      newValue: "",
    });
  });
  const expectOutput = getExpectedUpdateOutput({
    targetPaths,
    cachePath,
    bypassEmpty: true,
  });
  const output = await runSampleScript(`./multi_translate.sh`, true);
  expect(output).toBe(expectOutput);
});

function getExpectedUpdateOutput(args: {
  targetPaths: string[];
  cachePath: string;
  bypassEmpty: boolean;
}): string {
  const lines: string[] = [];
  const recv = args.bypassEmpty
    ? "Bypass 1 strings because they are empty..."
    : "Received 1 results from 'google-translate'...";
  args.targetPaths.forEach((targetPath) => {
    lines.push(
      ...[
        recv,
        "Update 1 existing translations",
        `Write target ${getDebugPath(targetPath)}`,
        `Write cache ${getDebugPath(args.cachePath)}`,
      ]
    );
  });
  return joinLines(lines);
}
