export interface WorkflowContext {
  values: Map<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  dependsOn?: string[];
  retries?: number;
  run: (context: WorkflowContext) => Promise<unknown>;
}

export interface ExecutionResult {
  outputs: Record<string, unknown>;
  trace: string[];
}

export async function executeWorkflow(tasks: WorkflowTask[]): Promise<ExecutionResult> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const pending = new Set(tasks.map((task) => task.id));
  const completed = new Set<string>();
  const context: WorkflowContext = { values: new Map() };
  const trace: string[] = [];

  while (pending.size > 0) {
    const ready = [...pending]
      .map((id) => byId.get(id)!)
      .filter((task) => (task.dependsOn ?? []).every((dependency) => completed.has(dependency)));

    if (ready.length === 0) {
      throw new Error("workflow contains a cycle or missing dependency");
    }

    for (const task of ready) {
      const retries = task.retries ?? 0;
      let attempt = 0;
      while (true) {
        try {
          attempt += 1;
          trace.push(`start:${task.id}:attempt:${attempt}`);
          const output = await task.run(context);
          context.values.set(task.id, output);
          trace.push(`success:${task.id}:attempt:${attempt}`);
          completed.add(task.id);
          pending.delete(task.id);
          break;
        } catch (error) {
          trace.push(`error:${task.id}:attempt:${attempt}`);
          if (attempt > retries) {
            throw error;
          }
        }
      }
    }
  }

  return { outputs: Object.fromEntries(context.values), trace };
}
