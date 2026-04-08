# Workflow Orchestrator TS

TypeScript workflow engine that executes DAG tasks with dependency resolution, retry handling, timeout guards, ready-group scheduling, and execution metadata. It reads more like the core of a job runner or internal platform service.

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
- dependency validation before execution
- execution trace, ready groups, and status reporting
- deterministic tests for orchestration behavior
