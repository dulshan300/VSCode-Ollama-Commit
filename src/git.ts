import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DiffResult {
  diff: string;
  isStaged: boolean;
  filesChanged: string[];
  isEmpty: boolean;
}

/**
 * Get the git diff for the current repository
 */
export async function getGitDiff(
  cwd: string,
  useStagedOnly: boolean
): Promise<DiffResult> {
  const [
    { stdout: stagedDiff },
    { stdout: stagedFiles },
    { stdout: unstagedDiff },
    { stdout: unstagedFiles }
  ] = await Promise.all([
    execAsync('git diff --cached --no-color', { cwd }),
    execAsync('git diff --cached --name-only', { cwd }),
    execAsync('git diff --no-color', { cwd }),
    execAsync('git diff --name-only', { cwd })
  ]);

  const hasStaged = !!stagedDiff.trim();
  const hasUnstaged = !!unstagedDiff.trim();

  if (!hasStaged && !hasUnstaged) {
    return { diff: '', isStaged: true, filesChanged: [], isEmpty: true };
  }

  if (!hasStaged && useStagedOnly) {
    return { diff: '', isStaged: true, filesChanged: [], isEmpty: true };
  }

  const allFiles = [
    ...stagedFiles.trim().split('\n'),
    ...unstagedFiles.trim().split('\n')
  ].filter(Boolean).filter((f, i, arr) => arr.indexOf(f) === i);

  // Combine staged and unstaged diffs with a separator
  let combinedDiff = '';
  if (hasStaged) {
    combinedDiff += '--- Staged changes (git diff --cached) ---\n' + stagedDiff;
  }
  if (hasUnstaged && !useStagedOnly) {
    if (combinedDiff) { combinedDiff += '\n'; }
    combinedDiff += '--- Unstaged changes (git diff) ---\n' + unstagedDiff;
  } else if (hasStaged && hasUnstaged) {
    combinedDiff += '\n--- Unstaged changes (git diff) ---\n' + unstagedDiff;
  }

  return {
    diff: combinedDiff,
    isStaged: hasStaged,
    filesChanged: allFiles,
    isEmpty: false
  };
}

/**
 * Get the last few commit messages for context
 */
export async function getRecentCommits(cwd: string, count = 3): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `git log --oneline -${count} --no-decorate`,
      { cwd }
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get the current branch name
 */
export async function getBranchName(cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a directory is inside a git repo
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd });
    return true;
  } catch {
    return false;
  }
}
