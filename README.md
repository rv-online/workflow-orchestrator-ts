# Workflow Orchestrator TS

Small TypeScript workflow engine that executes DAG tasks with retry support and execution traces. This is a good portfolio repo for showing systems design instincts without needing a large distributed environment.

## Scripts

```bash
npm test
npm run build
node dist/index.js
```

## Concepts Demonstrated

- topological dependency resolution
- retry policies
- execution trace generation
- predictable task contracts
