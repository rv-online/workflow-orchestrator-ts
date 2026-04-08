# Workflow Orchestrator TS

TypeScript workflow engine that executes DAG tasks with dependency resolution, retry handling, timeout guards, and detailed task status reporting. It reads like the core of a job runner or internal platform service.

## Scripts

```bash
npm test
npm run build
node dist/src/index.js
```

## Concepts Demonstrated

- topological dependency resolution
- retry policies and attempt accounting
- timeout enforcement for slow tasks
- execution trace and status reporting
- deterministic tests for orchestration behavior
