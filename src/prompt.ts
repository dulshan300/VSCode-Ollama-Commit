export type CommitStyle = 'conventional' | 'simple' | 'detailed';

const CONVENTIONAL_PROMPT = `You are an expert software developer writing git commit messages.

Analyze the following git diff and generate a commit message in Conventional Commits format.

Rules:
- Format: <type>(<scope>): <short description>
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Scope is optional but use it when changes target a specific module/component
- Short description: present tense, lowercase, no period, max 72 chars
- Optionally add a blank line then a body with bullet points for complex changes
- Be specific: mention what changed, not just "update code"

Examples:
  feat(auth): add OAuth2 login with Google
  fix(api): handle null response from /users endpoint
  refactor(cart): extract price calculation to separate service

Git diff:
{{diff}}

Recent commits for context:
{{commits}}

Respond ONLY with the commit message, no explanation or markdown:`;

const SIMPLE_PROMPT = `You are an expert software developer writing git commit messages.

Analyze the following git diff and write a single clear, concise commit message.

Rules:
- One line only, max 72 characters
- Use imperative mood ("add feature" not "added feature")  
- Be specific about what changed

Git diff:
{{diff}}

Respond ONLY with the commit message, nothing else:`;

const DETAILED_PROMPT = `You are an expert AI commit message generator specialized in creating concise, informative commit messages that follow best practices in version control.

Your ONLY task is to generate a well-structured commit message based on the provided diff. The commit message must:
1. Use a clear, descriptive title in the imperative mood (50 characters max)
2. Provide a detailed explanation of changes in bullet points
3. Focus solely on the technical changes in the code
4. Use present tense and be specific about modifications

Key Guidelines:
- Analyze the entire diff comprehensively
- Capture the essence of only MAJOR changes
- Use technical, precise languages
- Avoid generic or vague descriptions
- Avoid quoting any word or sentences
- Avoid adding description for minor changes with not much context
- Return just the commit message, no additional text
- Don't return more bullet points than required
- Generate a single commit message

Output Format:
Concise Title Summarizing Changes

- Specific change description
- Another specific change description
- Rationale for key modifications
- Impact of changes


Git diff:
{{diff}}

Recent commits for context:
{{commits}}

Branch: {{branch}}

Respond ONLY with the commit message, no explanation or markdown:`;

export function buildPrompt(options: {
  style: CommitStyle;
  diff: string;
  commits: string[];
  branch: string;
  maxDiffLength: number;
  customPrompt?: string;
}): string {
  const { style, diff, commits, branch, maxDiffLength, customPrompt } = options;

  const truncatedDiff =
    diff.length > maxDiffLength
      ? diff.substring(0, maxDiffLength) + '\n\n... [diff truncated]'
      : diff;

  const recentCommits =
    commits.length > 0 ? commits.join('\n') : 'No previous commits';

  const template = customPrompt
    ? customPrompt
    : style === 'conventional'
    ? CONVENTIONAL_PROMPT
    : style === 'simple'
    ? SIMPLE_PROMPT
    : DETAILED_PROMPT;

  return template
    .replace('{{diff}}', truncatedDiff)
    .replace('{{commits}}', recentCommits)
    .replace('{{branch}}', branch);
}
