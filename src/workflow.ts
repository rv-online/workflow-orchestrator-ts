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

export interface ExecutionSummary {
  taskCount: number;
  completedCount: number;
  failedCount: number;
  totalAttempts: number;
  readyLayerCount: number;
  durationMs: number;
  maxLayerWidth: number;
}

export interface ExecutionResult {
  outputs: Record<string, unknown>;
  trace: string[];
  statuses: Record<string, TaskStatus>;
  executionOrder: string[];
  readyGroups: string[][];
  summary: ExecutionSummary;
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

function toLayeredBatches(tasks: WorkflowTask[], byId: Map<string, WorkflowTask>): WorkflowTask[][] {
  const pending = new Set(tasks.map((task) => task.id));
  const completed = new Set<string>();
  const layers: WorkflowTask[][] = [];

  while (pending.size > 0) {
    const ready = [...pending]
      .map((id) => byId.get(id)!)
      .filter((task) => (task.dependsOn ?? []).every((dependency) => completed.has(dependency)))
      .sort((left, right) => (right.metadata?.priority ?? 0) - (left.metadata?.priority ?? 0) || left.id.localeCompare(right.id));

    if (ready.length === 0) {
      throw new Error("workflow contains a cycle or missing dependency");
    }

    layers.push(ready);
    for (const task of ready) {
      pending.delete(task.id);
      completed.add(task.id);
    }
  }

  return layers;
}

async function runTask(task: WorkflowTask, context: WorkflowContext, trace: string[]): Promise<TaskStatus> {
  const retries = task.retries ?? 0;
  let attempt = 0;
  while (true) {
    try {
      attempt += 1;
      const startedAt = new Date().toISOString();
      trace.push(`start:${task.id}:attempt:${attempt}`);
      const output = await withTimeout(task.run(context), task.timeoutMs);
      context.values.set(task.id, output);
      const finishedAt = new Date().toISOString();
      trace.push(`success:${task.id}:attempt:${attempt}`);
      return {
        attempts: attempt,
        status: "success",
        startedAt,
        finishedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trace.push(`error:${task.id}:attempt:${attempt}:${message}`);
      if (attempt > retries) {
        return {
          attempts: attempt,
          status: "failed",
          finishedAt: new Date().toISOString(),
          lastError: message,
        };
      }
    }
  }
}

export async function executeWorkflow(tasks: WorkflowTask[]): Promise<ExecutionResult> {
  validateWorkflow(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const context: WorkflowContext = { values: new Map() };
  const trace: string[] = [];
  const statuses = new Map<string, TaskStatus>();
  const executionOrder: string[] = [];
  const readyGroups: string[][] = [];
  const startedAt = performance.now();
  const layers = toLayeredBatches(tasks, byId);

  for (const layer of layers) {
    readyGroups.push(layer.map((task) => task.id));
    const results = await Promise.all(layer.map(async (task) => [task.id, await runTask(task, context, trace)] as const));
    for (const [taskId, status] of results) {
      statuses.set(taskId, status);
      executionOrder.push(taskId);
      if (status.status === "failed") {
        throw new Error(status.lastError ?? `task failed: ${taskId}`);
      }
    }
  }

  const durationMs = Number((performance.now() - startedAt).toFixed(3));
  const totalAttempts = [...statuses.values()].reduce((sum, status) => sum + status.attempts, 0);
  const failedCount = [...statuses.values()].filter((status) => status.status === "failed").length;
  const completedCount = statuses.size - failedCount;

  return {
    outputs: Object.fromEntries(context.values),
    trace,
    statuses: Object.fromEntries(statuses),
    executionOrder,
    readyGroups,
    summary: {
      taskCount: tasks.length,
      completedCount,
      failedCount,
      totalAttempts,
      readyLayerCount: layers.length,
      durationMs,
      maxLayerWidth: Math.max(...layers.map((layer) => layer.length), 0),
    },
  };
}
