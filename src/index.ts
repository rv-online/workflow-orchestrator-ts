import { executeWorkflow, type WorkflowTask } from "./workflow.js";

const tasks: WorkflowTask[] = [
  {
    id: "extract",
    metadata: { owner: "data-platform", priority: 3 },
    run: async () => ["acct-101", "acct-102"],
  },
  {
    id: "score",
    dependsOn: ["extract"],
    metadata: { owner: "data-platform", priority: 2 },
    run: async (context) => {
      const customers = context.values.get("extract") as string[];
      return customers.map((customerId, index) => ({ customerId, score: 80 + index * 10 }));
    },
  },
  {
    id: "publish",
    dependsOn: ["score"],
    metadata: { owner: "platform", priority: 1 },
    run: async (context) => ({
      published: true,
      rows: (context.values.get("score") as Array<unknown>).length,
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
