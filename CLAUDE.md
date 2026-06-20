# Claude Code 工作规则

## Git 工作流：走 PR，永不直接 push main

每一次代码改动(spec/plan/memory 之外的所有源码与配置变更)走 PR 流程，不再直接 `git push origin main`。

### 5 步流程

```bash
# 1. 从最新 main 切 feature 分支
git checkout main && git pull
git checkout -b <topic-branch>          # 命名: sprint-N-<topic> 或 fix/<bug> 或 chore/<task>

# 2. 干活 + commit (跟之前一样，frequent commits)

# 3. 推送 feature 分支
git push -u origin <topic-branch>       # 首次 -u 关联 remote

# 4. 开 PR (Claude/subagent 都到这一步停手，等 user 审查)
gh pr create --title "..." --body "..."

# 5. (user 审查后由 user 触发) merge
gh pr merge --squash --delete-branch    # squash = 锁定策略, 永远用这个
```

### 硬规则

- **永远不要** `git push origin main` 直接推 main
- **永远不要**自己 `gh pr merge` — 必须等 user 显式说"merge"
- Merge 策略 **锁定 squash**(2026-06-20 user 选定)，除非 user 当次 PR 明确说用 `--merge` 或 `--rebase`
- 创建 PR 后 STOP，告诉 user PR URL + summary，等 user review

### 例外

- Memory 文件(`~/.claude/projects/...`)在 repo 外，不受此规则约束
- 修复 PR 的 fixup commit 推到同一 feature 分支即可(PR 会自动更新)

## 其他规则

详见 [`docs/superpowers/`](docs/superpowers/) 下的 spec / plan 文件夹，以及 user memory(`~/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/`)。
