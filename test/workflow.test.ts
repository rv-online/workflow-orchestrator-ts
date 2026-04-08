import assert from "node:assert/strict";
import test from "node:test";
import { executeWorkflow } from "../src/workflow.js";

test("executes dependent tasks and records statuses", async () => {
  const result = await executeWorkflow([
    {
      id: "extract",
      run: async () => [1, 2, 3],
    },
    {
      id: "transform",
      dependsOn: ["extract"],
      run: async (context) => (context.values.get("extract") as number[]).map((value) => value * 2),
    },
  ]);

  assert.deepEqual(result.outputs.transform, [2, 4, 6]);
  assert.equal(result.statuses.extract.status, "success");
  assert.equal(result.trace[0], "start:extract:attempt:1");
});

test("retries failed tasks before succeeding", async () => {
  let attempts = 0;
  const result = await executeWorkflow([
    {
      id: "flaky",
      retries: 2,
      run: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("temporary");
        }
        return "ok";
      },
    },
  ]);

  assert.equal(result.outputs.flaky, "ok");
  assert.equal(result.statuses.flaky.attempts, 2);
});

test("fails timed out tasks with a clear error", async () => {
  await assert.rejects(
    executeWorkflow([
      {
        id: "slow",
        timeoutMs: 10,
        run: async () => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return "late";
        },
      },
    ]),
    /timed out/
  );
});
