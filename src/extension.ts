import * as vscode from 'vscode';
import { getGitDiff, getRecentCommits, getBranchName, isGitRepo } from './git';
import { fetchModels, generateWithOllama } from './ollama';
import { buildPrompt, CommitStyle } from './prompt';

let statusBarItem: vscode.StatusBarItem;

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  console.log('Ollama Commit extension activated');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('ollamaCommit.generate', () =>
      runGenerate(context)
    ),
    vscode.commands.registerCommand('ollamaCommit.generateWithPicker', () =>
      runGenerateWithPicker(context)
    ),
    vscode.commands.registerCommand('ollamaCommit.showDiff', () =>
      runShowDiffAndGenerate(context)
    )
  );

  // Status bar button
  setupStatusBar(context);
}

export function deactivate() {
  statusBarItem?.dispose();
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

function setupStatusBar(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('ollamaCommit');
  if (!config.get<boolean>('showStatusBar', true)) return;

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'ollamaCommit.generate';
  statusBarItem.text = '$(sparkle) Ollama Commit';
  statusBarItem.tooltip = 'Generate commit message with Ollama';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);

  // Update status bar on config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ollamaCommit.showStatusBar')) {
        const show = vscode.workspace
          .getConfiguration('ollamaCommit')
          .get<boolean>('showStatusBar', true);
        show ? statusBarItem.show() : statusBarItem.hide();
      }
    })
  );
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function runGenerate(_context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('ollamaCommit');
  const model = config.get<string>('model', 'llama3');
  const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');

  await generateAndApply({ model, ollamaUrl });
}

async function runGenerateWithPicker(_context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('ollamaCommit');
  const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');

  // Fetch available models
  let models: string[] = [];
  try {
    const result = await fetchModels(ollamaUrl);
    models = result.map((m) => m.name);
  } catch {
    vscode.window.showErrorMessage(
      `Could not fetch Ollama models from ${ollamaUrl}. Is Ollama running?`
    );
    return;
  }

  if (models.length === 0) {
    vscode.window.showWarningMessage(
      'No Ollama models found. Run `ollama pull llama3` to download one.'
    );
    return;
  }

  const currentModel = config.get<string>('model', 'llama3');
  const picked = await vscode.window.showQuickPick(models, {
    title: 'Select Ollama Model',
    placeHolder: 'Search models...'
  });

  if (!picked) return;

  await generateAndApply({ model: picked, ollamaUrl });
}

async function runShowDiffAndGenerate(_context: vscode.ExtensionContext) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const config = vscode.workspace.getConfiguration('ollamaCommit');
  const useStagedOnly = config.get<boolean>('useStagedOnly', true);

  const diffResult = await getGitDiff(workspaceRoot, useStagedOnly);
  if (diffResult.isEmpty) {
    vscode.window.showWarningMessage(
      useStagedOnly
        ? 'No staged changes. Stage files with `git add` first.'
        : 'No changes detected in the repository.'
    );
    return;
  }

  // Show diff in a new editor tab
  const doc = await vscode.workspace.openTextDocument({
    language: 'diff',
    content: diffResult.diff
  });
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);

  // Then generate
  const model = config.get<string>('model', 'llama3');
  const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
  await generateAndApply({ model, ollamaUrl });
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function generateAndApply(opts: { model: string; ollamaUrl: string }) {
  const { model, ollamaUrl } = opts;
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  // Check git repo
  const isRepo = await isGitRepo(workspaceRoot);
  if (!isRepo) {
    vscode.window.showErrorMessage('This workspace is not a git repository.');
    return;
  }

  const config = vscode.workspace.getConfiguration('ollamaCommit');
  const useStagedOnly = config.get<boolean>('useStagedOnly', true);
  const maxDiffLength = config.get<number>('maxDiffLength', 4000);
  const commitStyle = config.get<CommitStyle>('commitStyle', 'conventional');
  const customPrompt = config.get<string>('customPrompt', '');

  // Gather git context
  let diffResult;
  let commits: string[] = [];
  let branch = 'main';

  try {
    [diffResult, commits, branch] = await Promise.all([
      getGitDiff(workspaceRoot, useStagedOnly),
      getRecentCommits(workspaceRoot),
      getBranchName(workspaceRoot)
    ]);
  } catch (err) {
    vscode.window.showErrorMessage(`Git error: ${String(err)}`);
    return;
  }

  if (diffResult.isEmpty) {
    vscode.window.showWarningMessage(
      useStagedOnly
        ? 'No staged changes found. Run `git add <files>` first, or disable "useStagedOnly" in settings.'
        : 'No changes detected in the repository.'
    );
    return;
  }

  // Build prompt
  const prompt = buildPrompt({
    style: commitStyle,
    diff: diffResult.diff,
    commits,
    branch,
    maxDiffLength,
    customPrompt: customPrompt || undefined
  });

  // Generate with progress UI
  let generatedMessage = '';
  let streamPreview = '';

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Ollama Commit (${model})`,
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: 'Analyzing diff...' });

      // Update status bar while generating
      if (statusBarItem) {
        statusBarItem.text = '$(loading~spin) Generating...';
      }

      try {
        generatedMessage = await generateWithOllama({
          model,
          prompt,
          ollamaUrl,
          onProgress: (token) => {
            // Streaming tokens arrive here – update progress message
            streamPreview += token;
            const preview = streamPreview.slice(0, 40);
            progress.report({ message: preview ? `"${preview}..."` : 'Generating...' });
          }
        });
      } finally {
        if (statusBarItem) {
          statusBarItem.text = '$(sparkle) Ollama Commit';
        }
      }
    }
  );

  if (!generatedMessage) {
    vscode.window.showErrorMessage('Ollama returned an empty response. Try a different model.');
    return;
  }

  // Apply to SCM input box if possible
  const applied = tryApplyToScmInput(generatedMessage);

  if (!applied) {
    // Fallback: show in a dialog with copy option
    await showMessageDialog(generatedMessage, model);
  } else {
    // Show a brief success notification with edit option
    vscode.window.showInformationMessage(
      `✅ Commit message generated with ${model}`,
      'Edit & Accept',
      'Regenerate'
    ).then((action) => {
      if (action === 'Edit & Accept') {
        vscode.commands.executeCommand('workbench.view.scm');
      } else if (action === 'Regenerate') {
        generateAndApply(opts);
      }
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Try to put the message directly into VS Code's Source Control input box
 */
function tryApplyToScmInput(message: string): boolean {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension?.isActive) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const git = (gitExtension.exports as any).getAPI(1);
    if (!git?.repositories?.length) return false;

    git.repositories[0].inputBox.value = message;
    return true;
  } catch {
    return false;
  }
}

/**
 * Show an interactive dialog when we can't auto-populate the SCM box
 */
async function showMessageDialog(message: string, model: string) {
  const truncated = message.length > 200 ? message.slice(0, 200) + '...' : message;

  const action = await vscode.window.showInformationMessage(
    `Generated with ${model}:\n\n${truncated}`,
    { modal: true },
    'Copy to Clipboard',
    'Open in Editor',
    'Regenerate'
  );

  switch (action) {
    case 'Copy to Clipboard':
      await vscode.env.clipboard.writeText(message);
      vscode.window.showInformationMessage('Commit message copied to clipboard!');
      break;

    case 'Open in Editor': {
      const doc = await vscode.workspace.openTextDocument({
        language: 'text',
        content: message
      });
      await vscode.window.showTextDocument(doc);
      break;
    }
  }
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder is open.');
    return undefined;
  }
  return folders[0].uri.fsPath;
}
