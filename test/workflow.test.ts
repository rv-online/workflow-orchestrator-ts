import assert from "node:assert/strict";
import test from "node:test";
import { executeWorkflow } from "../src/workflow.js";

test("executes tasks in dependency order", async () => {
  const result = await executeWorkflow([
    {
      id: "a",
      run: async () => 1,
    },
    {
      id: "b",
      dependsOn: ["a"],
      run: async (context) => (context.values.get("a") as number) + 1,
    },
  ]);

  assert.equal(result.outputs.a, 1);
  assert.equal(result.outputs.b, 2);
});

test("retries failing tasks", async () => {
  let attempts = 0;
  const result = await executeWorkflow([
    {
      id: "unstable",
      retries: 1,
      run: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary");
        }
        return "ok";
      },
    },
  ]);

  assert.equal(result.outputs.unstable, "ok");
  assert.equal(attempts, 2);
});
