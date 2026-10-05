import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  CompatibleProvider,
  DisabledProvider,
  getProvider,
  localInference,
  scrubPublicText,
} from '@/backend/recommendations/provider';
import { ranking } from '@/backend/recommendations/config';

const vector = Array.from({ length: ranking.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0));
const inference = {
  skills: [],
  interests: ['Product'],
  lookingFor: ['UI/UX Designer'],
  domains: ['SaaS'],
};
const http = vi.fn<typeof fetch>();
const provider = (model?: string) =>
  new CompatibleProvider(
    'https://provider.example/v1///',
    'test-only-key',
    'embedding-test',
    model,
  );
const json = (value: unknown) => new Response(JSON.stringify(value));
beforeEach(() => {
  http.mockReset().mockRejectedValue(new Error('Unexpected HTTP request'));
  vi.stubGlobal('fetch', http);
  for (const name of [
    'AI_PROVIDER',
    'AI_API_KEY',
    'AI_BASE_URL',
    'EMBEDDING_MODEL',
    'AI_TEXT_MODEL',
  ])
    vi.stubEnv(name, undefined);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([undefined, 'disabled'])(
  'keeps %s provider local even with remote settings',
  async (mode) => {
    vi.stubEnv('AI_PROVIDER', mode);
    vi.stubEnv('AI_API_KEY', 'test-only-key');
    vi.stubEnv('AI_BASE_URL', 'https://provider.example/v1');
    vi.stubEnv('EMBEDDING_MODEL', 'embedding-test');
    const p = getProvider();
    expect(p).toBeInstanceOf(DisabledProvider);
    expect(await p.generateEmbedding('SaaS')).toEqual([]);
    expect(await p.extractStructuredProfile('SaaS')).toEqual(localInference('SaaS'));
    expect(await p.classifyContent('SaaS')).toEqual(localInference('SaaS'));
    expect(http).not.toHaveBeenCalled();
  },
);

it.each(['AI_API_KEY', 'AI_BASE_URL', 'EMBEDDING_MODEL'])(
  'falls back when %s is blank',
  (missing) => {
    vi.stubEnv('AI_PROVIDER', 'compatible');
    vi.stubEnv('AI_API_KEY', 'test-only-key');
    vi.stubEnv('AI_BASE_URL', 'https://provider.example/v1');
    vi.stubEnv('EMBEDDING_MODEL', 'embedding-test');
    expect(getProvider()).toBeInstanceOf(CompatibleProvider);
    vi.stubEnv(missing, '   ');
    expect(getProvider()).toBeInstanceOf(DisabledProvider);
    expect(http).not.toHaveBeenCalled();
  },
);

it.each([
  'ftp://localhost/v1',
  'http://provider.example/v1',
  'https://user:pass@provider.example/v1',
  'https://provider.example/v1?q=1',
  'https://provider.example/v1#x',
])('rejects unsafe or ambiguous endpoint %s', (url) => {
  expect(() => new CompatibleProvider(url, 'test-only-key', 'embedding-test')).toThrow(
    'invalid_provider_endpoint',
  );
});
it('permits HTTP loopback only outside production', () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(
    () => new CompatibleProvider('http://127.0.0.1:8080/v1', 'test-only-key', 'embed'),
  ).not.toThrow();
  vi.stubEnv('NODE_ENV', 'production');
  expect(
    () => new CompatibleProvider('http://127.0.0.1:8080/v1', 'test-only-key', 'embed'),
  ).toThrow();
});

it('posts scrubbed embeddings with configured dimensions, timeout and no redirects', async () => {
  http.mockResolvedValueOnce(json({ data: [{ embedding: vector }] }));
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  expect(
    await provider().generateEmbedding('Contact me@example.com https://example.com 9876543210'),
  ).toEqual(vector);
  const [url, init] = http.mock.calls[0];
  expect(url).toBe('https://provider.example/v1/embeddings');
  expect(init).toMatchObject({
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: 'Bearer test-only-key', 'Content-Type': 'application/json' },
  });
  expect(JSON.parse(init!.body as string)).toEqual({
    model: 'embedding-test',
    dimensions: ranking.embeddingDimensions,
    input: 'Contact [email] [link] [number]',
  });
  expect(timeout).toHaveBeenCalledWith(ranking.providerTimeoutMs);
  expect(init!.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('test-only-key');
});
it('preserves serialized field boundaries while scrubbing URLs', () => {
  expect(
    JSON.parse(
      scrubPublicText(JSON.stringify({ bio: 'https://example.com', interests: ['Product'] })),
    ),
  ).toEqual({ bio: '[link]', interests: ['Product'] });
});
it('uses local extraction when the optional text model is absent', async () => {
  expect(await provider().extractStructuredProfile('SaaS')).toEqual(localInference('SaaS'));
  expect(http).not.toHaveBeenCalled();
});
it.each(['extractStructuredProfile', 'classifyContent'] as const)(
  'supports structured %s without inferring skills',
  async (method) => {
    http.mockResolvedValueOnce(
      json({
        choices: [
          { message: { content: JSON.stringify({ ...inference, skills: ['Web Development'] }) } },
        ],
      }),
    );
    expect(await provider('text-test')[method]('SaaS me@example.com')).toEqual(inference);
    expect(http.mock.calls[0][0]).toBe('https://provider.example/v1/chat/completions');
    expect(JSON.parse(http.mock.calls[0][1]!.body as string)).toMatchObject({
      model: 'text-test',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system' }, { role: 'user', content: 'SaaS [email]' }],
    });
  },
);
it.each([
  [],
  [1, 2],
  Array(ranking.embeddingDimensions).fill(0),
  Array(ranking.embeddingDimensions).fill('1'),
  Array(ranking.embeddingDimensions).fill(null),
  undefined,
])('rejects invalid embedding %#', async (embedding) => {
  http.mockResolvedValueOnce(json({ data: [{ embedding }] }));
  await expect(provider().generateEmbedding('test')).rejects.toThrow();
});
it.each([
  'not JSON',
  JSON.stringify({ ...inference, interests: ['Invented label'] }),
  JSON.stringify({ ...inference, unexpected: true }),
  JSON.stringify({ ...inference, domains: Array(8).fill('SaaS') }),
  'null',
])('rejects invalid structured content %#', async (content) => {
  http.mockResolvedValueOnce(json({ choices: [{ message: { content } }] }));
  await expect(provider('text-test').extractStructuredProfile('test')).rejects.toThrow();
});
it.each([{}, { choices: [] }, { choices: [{ message: { content: null } }] }])(
  'rejects missing chat output %#',
  async (body) => {
    http.mockResolvedValueOnce(json(body));
    await expect(provider('text-test').extractStructuredProfile('test')).rejects.toThrow();
  },
);
it.each([401, 429, 500])('rejects HTTP %s without logging response content', async (status) => {
  http.mockResolvedValueOnce(new Response('private provider error', { status }));
  await expect(provider().generateEmbedding('private input')).rejects.toThrow(
    'provider_unavailable',
  );
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/private|test-only-key/);
});
it('rejects network errors and timeouts', async () => {
  http.mockRejectedValueOnce(new TypeError('network failure'));
  await expect(provider().generateEmbedding('test')).rejects.toThrow();
  http.mockImplementationOnce(async (_url, init) => {
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    throw new DOMException('Timed out', 'TimeoutError');
  });
  await expect(provider().generateEmbedding('test')).rejects.toThrow('Timed out');
});
it.each([new Response('not json'), new Response(null)])(
  'rejects malformed or empty HTTP bodies %#',
  async (response) => {
    http.mockResolvedValueOnce(response);
    await expect(provider().generateEmbedding('test')).rejects.toThrow();
  },
);
it('cancels streamed responses exceeding the byte limit', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(60_000));
      controller.enqueue(new Uint8Array(40_001));
    },
    cancel,
  });
  http.mockResolvedValueOnce(new Response(body));
  await expect(provider().generateEmbedding('test')).rejects.toThrow('provider_response_too_large');
  expect(cancel).toHaveBeenCalledOnce();
});
