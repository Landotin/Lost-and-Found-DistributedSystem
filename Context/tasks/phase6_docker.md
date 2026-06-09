# Phase 6 Docker & Orchestration Subagent Task

Welcome to Phase 6! You are assigned to the `rdlft-phase6-docker` worktree.
Your task is to containerize the Department Nodes and unify the demo deployment.

**CRITICAL PREREQUISITE**: Before starting, you MUST read the `AGENTS.md` and `MEMORY.md` files located in the root of the project to understand the architectural rules, coding standards, and what has been completed so far.

## Objective
The goal is to enable a single-command `docker compose up` that launches:
1. Central Hub
2. Hub Dashboard
3. Department Node 1 (CCS)
4. Department Node 2 (COE)

## Tasks
1. **Node Dockerfile**: Create a `Dockerfile` inside the `client/` directory. It should build the React Vite frontend and serve it using the `client/server` Express app. The Express app runs on port 3000 by default. Ensure the Dockerfile does a multi-stage build or properly installs both client and server dependencies.
2. **Unified `docker-compose.yml`**: Update the `docker-compose.yml` file in the project root. Add `dept_ccs` and `dept_coe` services. They must use the new `client` Dockerfile context.
3. **Environment Injection**: Set the required environment variables for the node services as described in `Context/PRD.md` (`DEPT_NAME`, `SERVER_WS_URL`, and `DEPT_SECRET`).
4. **Verification**: Run `docker compose up --build -d` and verify that all containers start up successfully, that the nodes connect to the hub (check hub logs or hit the hub's health endpoint), and that there are no immediate crashes.

**Rules**:
- Practice TDD where applicable (though this is DevOps focused).
- Make sure not to break existing Hub or Hub Dashboard configurations.
- Update `MEMORY.md` under a new sub-heading for your session when you complete the task.
- Document any errors in `Context/ERROR.md`.
- Ensure all commands are executed inside your worktree.
