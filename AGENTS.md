# AGENTS.md

## Project Context

- This project is a drop-in replacement for Mendix PWT.
- When implementing or changing features, compare the behavior against the existing Mendix PWT and verify that the result can work as a drop-in replacement, including compatible APIs, behavior, outputs, and integration expectations.

## Sub-Agent Usage

- When spawning sub-agents, use `gpt-5.6` with `high` reasoning effort for complex tasks and `max` for the most demanding tasks. Use `gpt-5.6-terra` for lightweight, read-heavy parallel work when speed and efficiency matter. If GPT-5.6 is unavailable in the current Codex workspace, use the strongest available model and reasoning effort.
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
