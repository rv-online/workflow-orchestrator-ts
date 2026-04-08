import { executeWorkflow, type WorkflowTask } from "./workflow.js";

const tasks: WorkflowTask[] = [
  {
    id: "extract",
    run: async () => ["order-1", "order-2", "order-3"],
  },
  {
    id: "transform",
    dependsOn: ["extract"],
    run: async (context) => (context.values.get("extract") as string[]).map((item) => item.toUpperCase()),
  },
  {
    id: "load",
    dependsOn: ["transform"],
    run: async (context) => ({
      loadedCount: (context.values.get("transform") as string[]).length,
    }),
  },
];

executeWorkflow(tasks)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
