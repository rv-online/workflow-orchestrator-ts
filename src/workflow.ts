export interface WorkflowContext {
  values: Map<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  dependsOn?: string[];
  retries?: number;
  timeoutMs?: number;
  metadata?: {
    owner?: string;
    priority?: number;
  };
  run: (context: WorkflowContext) => Promise<unknown>;
}

export interface TaskStatus {
  attempts: number;
  status: "success" | "failed";
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
}

export interface ExecutionResult {
  outputs: Record<string, unknown>;
  trace: string[];
  statuses: Record<string, TaskStatus>;
  executionOrder: string[];
  readyGroups: string[][];
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

function validateWorkflow(tasks: WorkflowTask[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) {
      throw new Error(`duplicate task id: ${task.id}`);
    }
    ids.add(task.id);
  }

  for (const task of tasks) {
    for (const dependency of task.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(`missing dependency: ${dependency}`);
      }
    }
  }
}

export async function executeWorkflow(tasks: WorkflowTask[]): Promise<ExecutionResult> {
  validateWorkflow(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const pending = new Set(tasks.map((task) => task.id));
  const completed = new Set<string>();
  const context: WorkflowContext = { values: new Map() };
  const trace: string[] = [];
  const statuses = new Map<string, TaskStatus>();
  const executionOrder: string[] = [];
  const readyGroups: string[][] = [];

  while (pending.size > 0) {
    const ready = [...pending]
      .map((id) => byId.get(id)!)
      .sort((left, right) => (right.metadata?.priority ?? 0) - (left.metadata?.priority ?? 0))
      .filter((task) => (task.dependsOn ?? []).every((dependency) => completed.has(dependency)));

    if (ready.length === 0) {
      throw new Error("workflow contains a cycle or missing dependency");
    }

    readyGroups.push(ready.map((task) => task.id));

    for (const task of ready) {
      const retries = task.retries ?? 0;
      let attempt = 0;
      while (true) {
        try {
          attempt += 1;
          const startedAt = new Date().toISOString();
          trace.push(`start:${task.id}:attempt:${attempt}`);
          statuses.set(task.id, {
            attempts: attempt,
            status: "success",
            startedAt,
          });
          const output = await withTimeout(task.run(context), task.timeoutMs);
          context.values.set(task.id, output);
          trace.push(`success:${task.id}:attempt:${attempt}`);
          statuses.set(task.id, {
            attempts: attempt,
            status: "success",
            startedAt,
            finishedAt: new Date().toISOString(),
          });
          completed.add(task.id);
          pending.delete(task.id);
          executionOrder.push(task.id);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          trace.push(`error:${task.id}:attempt:${attempt}:${message}`);
          if (attempt > retries) {
            const previous = statuses.get(task.id);
            statuses.set(task.id, {
              attempts: attempt,
              status: "failed",
              startedAt: previous?.startedAt,
              finishedAt: new Date().toISOString(),
              lastError: message,
            });
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
    executionOrder,
    readyGroups,
  };
}
