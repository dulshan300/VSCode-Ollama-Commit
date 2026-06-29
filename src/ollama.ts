import * as https from 'https';
import * as http from 'http';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  ollamaUrl: string;
  onProgress?: (token: string) => void;
}

/**
 * Fetch the list of locally available Ollama models
 */
export async function fetchModels(ollamaUrl: string): Promise<OllamaModel[]> {
  const url = new URL('/api/tags', ollamaUrl);
  const data = await httpGet(url.toString());
  const parsed = JSON.parse(data) as { models: OllamaModel[] };
  return parsed.models || [];
}

/**
 * Generate a commit message using the Ollama API (streaming)
 */
export async function generateWithOllama(options: GenerateOptions): Promise<string> {
  const { model, prompt, ollamaUrl, onProgress } = options;
  const url = new URL('/api/generate', ollamaUrl);

  const body = JSON.stringify({
    model,
    prompt,
    stream: true,
    options: {
      temperature: 0.3,   // Lower = more deterministic commit messages
      top_p: 0.9,
      num_predict: 300    // Commit messages don't need to be long
    }
  });

  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const urlObj = new URL(url.toString());

    const req = lib.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        if (res.statusCode === 404) {
          reject(new Error(`Model "${model}" not found. Run: ollama pull ${model}`));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Ollama API error: HTTP ${res.statusCode}`));
          return;
        }

        let fullResponse = '';
        res.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line) as { response: string; done: boolean };
              if (json.response) {
                fullResponse += json.response;
                onProgress?.(json.response);
              }
              if (json.done) {
                resolve(fullResponse.trim());
              }
            } catch {
              // Ignore malformed JSON chunks
            }
          }
        });

        res.on('error', reject);
        res.on('end', () => resolve(fullResponse.trim()));
      }
    );

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        reject(new Error(`Cannot connect to Ollama at ${ollamaUrl}. Is Ollama running?`));
      } else {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}
