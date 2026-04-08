# Workflow Orchestrator TS

TypeScript workflow engine for DAG execution, dependency validation, retry handling, timeouts, and execution tracing.

## Why This Exists

This repo is meant to feel like the core of an internal job runner where correctness, sequencing, and observability matter.

## What This Demonstrates

- dependency resolution and invalid-graph detection
- retry, timeout, and execution-status reporting
- execution traces that make orchestration behavior reviewable

## Architecture

1. workflow tasks are registered with dependencies and runtime policies
1. the executor computes ready work, runs tasks, and captures detailed trace state
1. outputs summarize statuses, ordering, and task results for operators

## Run It

```bash
npm test
npm run build
node dist/src/index.js
```

## Verification

Use `npm test` and `npm run build`, then run the sample execution path for a concrete trace output.
