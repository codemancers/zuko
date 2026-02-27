## Rules

- Use 'bd' for task management.
- Never manage your own TODO/Tasks list.
- Present TODO/Tasks list (if you have created any) to the user for verification and sync them to 'bd'
- All the tasks created by should have detailed description and steps to achieve the same
- All the work that you do should be accompanied by a 'bd' task. See the IMPORTANT section below for exceptions.
- Before switching tasks, update the status and do a commit
- IMPORTANT: If you are asked to improve something, and there is a task already in-progress, leave a comment and proceed. Don't create a new task
- IMPORTANT: If you are asked to cross verify something, and there is a task already in-progress, leave a comment and proceed. Don't create a new task.

## IMPORTANT: Task creation exceptions

- Local server management (start/stop/status/logs) does not require a 'bd' task.

## Handful commands

- Use `bd list` to list all the tasks.
- Use `bd ready` to list tasks which are ready to pick up.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
