# Phase 6 End-to-End Testing Subagent Task

Welcome to Phase 6! You are assigned to the `rdlft-phase6-e2e` worktree.
Your task is to implement automated End-to-End (E2E) integration tests using Playwright.

**CRITICAL PREREQUISITE**: Before starting, you MUST read the `AGENTS.md` and `MEMORY.md` files located in the root of the project to understand the architectural rules, coding standards, and what has been completed so far.

## Objective
The goal is to prove the distributed Hub-and-Spoke architecture, eventual consistency, and offline capabilities by simulating real user flows across multiple browser contexts.

## Tasks
1. **Playwright Setup**: Initialize Playwright in a new `e2e/` folder in the project root. Install necessary dependencies (e.g., `@playwright/test`).
2. **Real-Time Sync Scenario**: Write a test that spins up the backend and frontend, submits an item on Node A, and verifies that the item appears immediately on Node B without a page refresh.
3. **Offline & Eventual Consistency Scenario**: Write a test that simulates an offline partition (e.g. by closing the Hub connection or mocking the network state), logs an item on Node A, verifies it saves locally (`synced=0`), restores the connection, and verifies the item automatically syncs to Node B.
4. **Verification**: Run `npx playwright test` to ensure your scenarios pass successfully against the local development environment.

**Rules**:
- Practice TDD. Write clean, reliable tests that aren't flaky.
- Follow the rules in `AGENTS.md` strictly.
- Update `MEMORY.md` under a new sub-heading for your session when you complete the task.
- Document any errors in `Context/ERROR.md`.
- Ensure all commands are executed inside your worktree.
