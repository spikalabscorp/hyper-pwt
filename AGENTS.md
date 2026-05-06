# AGENTS.md

## Project Context

- This project is a drop-in replacement for Mendix PWT.
- When implementing or changing features, compare the behavior against the existing Mendix PWT and verify that the result can work as a drop-in replacement, including compatible APIs, behavior, outputs, and integration expectations.

## Sub-Agent Usage

- When spawning a sub-agent, use the GPT-5.5 High or GPT-5.5 Xhigh model depending on the task's difficulty.
- For tasks that can be performed in parallel, use sub-agents to handle them.

## Commit Discipline

- Always split work into small, focused commits by task scope.
- Do not combine unrelated setup, implementation, documentation, formatting, generated output, or cleanup changes in one commit.
- Commit each completed scope before moving on when the work naturally has multiple scopes.
- Use concise conventional commit messages.
- Prefer commit boundaries like this:

```text
chore: replace tool package setup
refactor: update internal command implementation
docs: update usage documentation
chore: apply formatter and linter cleanup
```

- Before finishing a task that modified files, verify that the working tree is clean or explicitly explain any remaining uncommitted changes.
