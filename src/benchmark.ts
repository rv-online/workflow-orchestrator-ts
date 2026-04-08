import { executeWorkflow, type WorkflowTask } from "./workflow.js";

function makeLayeredWorkflow(layers: number, width: number): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  for (let layer = 0; layer < layers; layer += 1) {
    for (let index = 0; index < width; index += 1) {
      const id = `t-${layer}-${index}`;
      tasks.push({
        id,
        dependsOn: layer === 0 ? [] : Array.from({ length: width }, (_, parentIndex) => `t-${layer - 1}-${parentIndex}`),
        metadata: { owner: layer % 2 === 0 ? "data-platform" : "platform", priority: width - index },
        run: async (context) => {
          const dependencySum = (layer === 0 ? 0 : (context.values.get(`t-${layer - 1}-0`) as number) ?? 0);
          return dependencySum + layer + index;
        },
      });
    }
  }
  return tasks;
}

async function main(): Promise<void> {
  const iterations = Number(process.env.BENCH_ITERATIONS ?? "25");
  const layers = Number(process.env.BENCH_LAYERS ?? "8");
  const width = Number(process.env.BENCH_WIDTH ?? "6");
  const tasks = makeLayeredWorkflow(layers, width);

  const startedAt = process.hrtime.bigint();
  let totalMs = 0;
  let lastSummary = undefined as unknown;
  for (let index = 0; index < iterations; index += 1) {
    const result = await executeWorkflow(tasks);
    totalMs += result.summary.durationMs;
    lastSummary = result.summary;
  }
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  console.log(
    JSON.stringify(
      {
        iterations,
        layers,
        width,
        wallClockMs: Number(elapsedMs.toFixed(3)),
        averageWorkflowMs: Number((totalMs / iterations).toFixed(3)),
        throughputPerSecond: Number(((iterations * 1000) / elapsedMs).toFixed(2)),
        lastSummary,
      },
      null,
      2
    )
  );
}

if (import.meta.url.endsWith(process.argv[1]?.replaceAll("\\", "/") ?? "")) {
  void main();
}
