export interface WorkflowContext {
  values: Map<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  dependsOn?: string[];
  retries?: number;
  timeoutMs?: number;
  run: (context: WorkflowContext) => Promise<unknown>;
}

export interface TaskStatus {
  attempts: number;
  status: "success" | "failed";
  lastError?: string;
}

export interface ExecutionResult {
  outputs: Record<string, unknown>;
  trace: string[];
  statuses: Record<string, TaskStatus>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`task timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function executeWorkflow(tasks: WorkflowTask[]): Promise<ExecutionResult> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const pending = new Set(tasks.map((task) => task.id));
  const completed = new Set<string>();
  const context: WorkflowContext = { values: new Map() };
  const trace: string[] = [];
  const statuses = new Map<string, TaskStatus>();

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
          const output = await withTimeout(task.run(context), task.timeoutMs);
          context.values.set(task.id, output);
          trace.push(`success:${task.id}:attempt:${attempt}`);
          statuses.set(task.id, { attempts: attempt, status: "success" });
          completed.add(task.id);
          pending.delete(task.id);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          trace.push(`error:${task.id}:attempt:${attempt}:${message}`);
          if (attempt > retries) {
            statuses.set(task.id, { attempts: attempt, status: "failed", lastError: message });
            throw error;
          }
        }
      }
    }
  }

  return {
    outputs: Object.fromEntries(context.values),
    trace,
    statuses: Object.fromEntries(statuses),
  };
}
