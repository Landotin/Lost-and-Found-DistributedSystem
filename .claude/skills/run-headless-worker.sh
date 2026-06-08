#!/bin/bash
# Launch an autonomous Claude Code worker in a target worktree directory.
# Usage: run-headless-worker.sh <WORKTREE_DIR> <TASK_FILE> [MODEL]
#
# Sources NVM so the `claude` binary is available in non-interactive shells.

WORKTREE_DIR=$1
TASK_FILE=$2
MODEL=${3:-deepseek-v4-flash}

# Source NVM for non-interactive shell
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

echo "🤖 Launching Autonomous Worker in $WORKTREE_DIR (model: $MODEL)..."

# Navigate into the target worktree directory
cd "$WORKTREE_DIR" || exit 1

# Execute Claude Code in programmatic non-interactive mode (-p)
# --bare skips slow interactive animations (and avoids effortLevel inheritance)
# --model explicitly selects the model (DeepSeek compatible)
# --allowedTools grants the worker access to the tools it needs
claude -p "Act as our @worker. Fulfill the contract in $TASK_FILE. Follow strict TDD: write failing tests first, then implement. Run the test suite and fix errors up to 2 times before stopping. Log progress to progress.log." \
  --bare \
  --model "$MODEL" \
  --allowedTools "Read,Write,Edit,Bash,Grep,Glob"

echo "✅ Autonomous Worker completed task for $WORKTREE_DIR"
