# Ollama Commit — VS Code Extension

Generate meaningful git commit messages using your **local** Ollama models — no API keys, no cloud, 100% private.

![Demo](docs/demo.gif)

---

## Features

- **One-click generation** from the Source Control panel or status bar
- **Streams tokens** in real-time as Ollama generates
- **Three commit styles**: Conventional Commits, Simple, or Detailed
- **Model picker**: choose any locally installed Ollama model on the fly
- **Diff preview**: open the diff side-by-side before generating
- **Auto-fills** VS Code's git commit input box directly
- **Fully configurable**: URL, model, prompt style, diff size limit

---

## Requirements

1. **Ollama** must be installed and running locally  
   → https://ollama.com/download

2. At least one model must be pulled:
   ```bash
   ollama pull llama3          # recommended (fast, good quality)
   ollama pull codellama       # great for code-heavy commits
   ollama pull mistral         # lightweight alternative
   ```

3. **VS Code** 1.85 or newer

---

## Installation

### Option A — Install from `.vsix` (easiest)

```bash
# Build the extension
cd vscode-ollama-commit
npm install
npm run package        # creates ollama-commit-1.0.0.vsix

# Install into VS Code
code --install-extension ollama-commit-1.0.0.vsix
```

### Option B — Run in development mode

1. Open the project folder in VS Code
2. Press `F5` — this opens an Extension Development Host window
3. Use the extension from there

---

## Usage

### From Source Control panel
Click the **✨ sparkle icon** in the Source Control (`Ctrl+Shift+G`) title bar.

### From Command Palette (`Ctrl+Shift+P`)
| Command | Description |
|---|---|
| `Ollama: Generate Commit Message` | Generate with your default model |
| `Ollama: Generate Commit Message (Pick Model)` | Choose from installed models first |
| `Ollama: Show Diff & Generate` | Open diff in editor, then generate |

### From Status Bar
Click **✨ Ollama Commit** in the bottom left of the status bar.

---

## Settings

Open Settings (`Ctrl+,`) and search for **"Ollama Commit"**:

| Setting | Default | Description |
|---|---|---|
| `ollamaCommit.ollamaUrl` | `http://localhost:11434` | Ollama server URL |
| `ollamaCommit.model` | `llama3` | Default model |
| `ollamaCommit.commitStyle` | `conventional` | `conventional` / `simple` / `detailed` |
| `ollamaCommit.useStagedOnly` | `true` | Only use `git diff --staged` |
| `ollamaCommit.maxDiffLength` | `4000` | Max characters of diff to send |
| `ollamaCommit.showStatusBar` | `true` | Show button in status bar |
| `ollamaCommit.customPrompt` | `""` | Override prompt (use `{{diff}}`, `{{commits}}`, `{{branch}}`) |

### Example `settings.json`

```json
{
  "ollamaCommit.model": "codellama",
  "ollamaCommit.commitStyle": "conventional",
  "ollamaCommit.ollamaUrl": "http://localhost:11434",
  "ollamaCommit.maxDiffLength": 6000
}
```

### Custom Prompt Example

```json
{
  "ollamaCommit.customPrompt": "Write a git commit for this diff using emoji prefixes (🐛 for fixes, ✨ for features, 📝 for docs).\n\nDiff:\n{{diff}}\n\nCommit message only:"
}
```

---

## Commit Styles

### `conventional` (default)
Follows the [Conventional Commits](https://www.conventionalcommits.org/) spec:
```
feat(auth): add refresh token rotation
fix(api): handle empty response from /users endpoint
```

### `simple`
One clear line, imperative mood:
```
Add user profile image upload with S3 storage
```

### `detailed`
Summary + body bullets for complex changes:
```
Refactor database connection pooling

- Replace single connection with pg-pool for concurrent queries
- Add connection timeout and retry logic
- Update environment variables: DB_POOL_MIN, DB_POOL_MAX
```

---

## Tips

- **Stage specific files** with `git add -p` before generating for more focused messages
- Use `codellama` or `deepseek-coder` models for code-heavy repos
- Set `maxDiffLength` higher (8000+) for large changesets, but expect slower generation
- The branch name is included in the detailed prompt — name branches descriptively!

---

## Troubleshooting

**"Cannot connect to Ollama"**  
Make sure Ollama is running: `ollama serve`

**"Model not found"**  
Pull the model first: `ollama pull llama3`

**"No staged changes"**  
Stage your files: `git add .` or use VS Code's Source Control panel to stage files

**Commit message is too generic**  
Try `codellama` or a larger model like `llama3:70b`. Also check your diff isn't being truncated — increase `maxDiffLength`.

---

## License

MIT
