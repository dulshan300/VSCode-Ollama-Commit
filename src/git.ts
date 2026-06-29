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
  // Try staged first
  const { stdout: stagedDiff } = await execAsync('git diff --staged --no-color', { cwd });
  const { stdout: stagedFiles } = await execAsync(
    'git diff --staged --name-only',
    { cwd }
  );

  if (stagedDiff.trim()) {
    return {
      diff: stagedDiff,
      isStaged: true,
      filesChanged: stagedFiles.trim().split('\n').filter(Boolean),
      isEmpty: false
    };
  }

  if (useStagedOnly) {
    return { diff: '', isStaged: true, filesChanged: [], isEmpty: true };
  }

  // Fallback to unstaged
  const { stdout: unstagedDiff } = await execAsync('git diff --no-color', { cwd });
  const { stdout: unstagedFiles } = await execAsync('git diff --name-only', { cwd });

  return {
    diff: unstagedDiff,
    isStaged: false,
    filesChanged: unstagedFiles.trim().split('\n').filter(Boolean),
    isEmpty: !unstagedDiff.trim()
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
