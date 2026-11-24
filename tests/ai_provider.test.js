const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  AIProviderFactory,
  GeminiProvider,
  OpenAICompatibleProvider,
  AnthropicProvider,
  convertGeminiContentsToOpenAIMessages,
  convertGeminiToolsToOpenAITools
} = require('../src/services/ai_provider');

describe('AI Provider & Model Metadata Unit Tests', () => {
  test('AIProviderFactory should create GeminiProvider instance', () => {
    const provider = AIProviderFactory.create('gemini', 'fake-key', 'gemini-2.5-flash');
    assert.ok(provider instanceof GeminiProvider);
  });

  test('GeminiProvider should extract metadata properly from models list', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-2.5-flash');

    // Mock client.models.list
    provider.client = {
      models: {
        list: async () => ({
          data: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast and versatile model for general tasks',
              inputTokenLimit: 1048576,
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/gemini-1.5-pro',
              displayName: 'Gemini 1.5 Pro',
              description: 'Complex reasoning model',
              inputTokenLimit: 2097152,
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Embedding Model',
              supportedGenerationMethods: ['embedContent']
            }
          ]
        })
      }
    };

    const models = await provider.getAvailableModels();
    assert.strictEqual(models.length, 2);

    const flash = models.find(m => m.id === 'gemini-2.5-flash');
    assert.ok(flash);
    assert.strictEqual(flash.tier, 'flash');
    assert.strictEqual(flash.isRecommended, true);
    assert.strictEqual(flash.supportsTools, true);
    assert.strictEqual(flash.contextStr, '1M Tokens');
    assert.strictEqual(flash.outputTokenLimit, 8192);
    assert.ok(flash.badge.includes('推薦免費使用'));

    const pro = models.find(m => m.id === 'gemini-1.5-pro');
    assert.ok(pro);
    assert.strictEqual(pro.tier, 'pro');
    assert.strictEqual(pro.isRecommended, false);
    assert.strictEqual(pro.supportsTools, true);
    assert.strictEqual(pro.contextStr, '2M Tokens');
    assert.ok(pro.badge.includes('深度旗艦'));
  });

  test('testModelAvailability should handle successful responses with tool support', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-2.5-flash');
    provider.client = {
      models: {
        generateContent: async () => ({
          text: 'Pong'
        })
      }
    };

    const result = await provider.testModelAvailability('gemini-2.5-flash');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.supportsTools, true);
    assert.strictEqual(result.reply, 'Pong');
    assert.ok(result.latencyMs >= 0);
  });

  test('testModelAvailability should detect tool calling unsupported errors', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-1.0-pro');
    provider.client = {
      models: {
        generateContent: async () => {
          throw new Error('400 Bad Request: Tool calling is not supported for this model');
        }
      }
    };

    const result = await provider.testModelAvailability('gemini-1.0-pro');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.supportsTools, false);
    assert.ok(result.error.includes('不支援 Agent 工具呼叫'));
  });

  test('testModelAvailability should detect quota 429 errors', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-1.5-pro');
    provider.client = {
      models: {
        generateContent: async () => {
          throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
        }
      }
    };

    const result = await provider.testModelAvailability('gemini-1.5-pro');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('429 Rate Limit'));
  });

  test('testModelAvailability should handle timeout properly', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-slow');
    provider.client = {
      models: {
        generateContent: () => new Promise(resolve => setTimeout(resolve, 500))
      }
    };

    const result = await provider.testModelAvailability('gemini-slow', 50);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('連線逾時'));
  });

  test('AIProviderFactory should instantiate OpenAI-compatible and Anthropic providers', () => {
    const groq = AIProviderFactory.create('groq', 'gsk_test', 'llama-3.3-70b-versatile');
    assert.ok(groq instanceof OpenAICompatibleProvider);
    assert.strictEqual(groq.baseUrl, 'https://api.groq.com/openai/v1');

    const ollama = AIProviderFactory.create('ollama', '', 'llama3.2');
    assert.ok(ollama instanceof OpenAICompatibleProvider);
    assert.strictEqual(ollama.baseUrl, 'http://localhost:11434/v1');

    const custom = AIProviderFactory.create('custom', 'key', 'my-model', { baseUrl: 'http://127.0.0.1:8080/v1/' });
    assert.ok(custom instanceof OpenAICompatibleProvider);
    assert.strictEqual(custom.baseUrl, 'http://127.0.0.1:8080/v1');

    const claude = AIProviderFactory.create('anthropic', 'sk-ant-test', 'claude-sonnet-4-20250514');
    assert.ok(claude instanceof AnthropicProvider);
  });

  test('convertGeminiContentsToOpenAIMessages and tools should translate multi-turn tool calls', () => {
    const contents = [
      { role: 'user', parts: [{ text: '幫我新增待辦買牛奶' }] },
      {
        role: 'model',
        parts: [
          { thought: true, text: '思考中' },
          { functionCall: { id: 'call_1', name: 'add_todo', args: { task: '買牛奶' } } }
        ]
      },
      {
        role: 'user',
        parts: [
          { functionResponse: { id: 'call_1', name: 'add_todo', response: { result: '已新增' } } }
        ]
      }
    ];

    const messages = convertGeminiContentsToOpenAIMessages(contents, '你是奇異鳥');
    assert.strictEqual(messages[0].role, 'system');
    assert.strictEqual(messages[0].content, '你是奇異鳥');
    assert.strictEqual(messages[1].role, 'user');
    assert.strictEqual(messages[2].role, 'assistant');
    assert.strictEqual(messages[2].tool_calls[0].id, 'call_1');
    assert.strictEqual(messages[2].tool_calls[0].function.name, 'add_todo');
    assert.strictEqual(messages[3].role, 'tool');
    assert.strictEqual(messages[3].tool_call_id, 'call_1');

    const openAiTools = convertGeminiToolsToOpenAITools([
      {
        functionDeclarations: [
          { name: 'add_todo', description: '新增待辦', parameters: { type: 'OBJECT', properties: { task: { type: 'STRING' } } } }
        ]
      }
    ]);
    assert.strictEqual(openAiTools.length, 1);
    assert.strictEqual(openAiTools[0].type, 'function');
    assert.strictEqual(openAiTools[0].function.parameters.type, 'object');
    assert.strictEqual(openAiTools[0].function.parameters.properties.task.type, 'string');
  });

  test('OpenAICompatibleProvider should parse tool_calls, reasoning_content and usage', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: '',
              reasoning_content: '需要先查剪貼簿',
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: { name: 'read_clipboard', arguments: '{}' }
                }
              ]
            }
          }
        ],
        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }
      })
    });

    const provider = AIProviderFactory.create('groq', 'gsk_fake', 'llama-3.3-70b-versatile', { fetchImpl: mockFetch });
    const res = await provider.generateContent({
      contents: [{ role: 'user', parts: [{ text: '讀剪貼簿' }] }],
      config: { systemInstruction: 'sys' }
    });

    assert.strictEqual(res.functionCalls.length, 1);
    assert.strictEqual(res.functionCalls[0].id, 'call_abc');
    assert.strictEqual(res.functionCalls[0].name, 'read_clipboard');
    assert.strictEqual(res.usageMetadata.totalTokenCount, 150);
    assert.ok(res.candidates[0].content.parts.some(p => p.thought && p.text === '需要先查剪貼簿'));
  });

  test('OpenAICompatibleProvider should list models and prioritize :free on OpenRouter', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: [
          { id: 'openai/gpt-4o', context_length: 128000 },
          { id: 'meta-llama/llama-3.3-70b-instruct:free', context_length: 131072 },
          { id: 'openai/text-embedding-3-small', context_length: 8192 }
        ]
      })
    });

    const provider = AIProviderFactory.create('openrouter', 'sk-or-fake', '', { fetchImpl: mockFetch });
    const models = await provider.getAvailableModels();
    assert.strictEqual(models.length, 2);
    assert.strictEqual(models[0].id, 'meta-llama/llama-3.3-70b-instruct:free');
    assert.ok(models[0].badge.includes(':free'));
  });

  test('OpenAICompatibleProvider should classify Ollama connection error clearly', async () => {
    const mockFetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };
    const provider = AIProviderFactory.create('ollama', '', 'llama3.2', { fetchImpl: mockFetch });
    const result = await provider.testModelAvailability('llama3.2', 2000);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Ollama'));
  });

  test('AnthropicProvider should convert messages and parse text, thinking and tool_use blocks', async () => {
    let capturedHeaders = null;
    const mockFetch = async (_url, init) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: [
            { type: 'thinking', thinking: '分析需求' },
            { type: 'text', text: '馬上處理！' },
            { type: 'tool_use', id: 'toolu_01', name: 'add_alarm', input: { time: '09:00' } }
          ],
          usage: { input_tokens: 80, output_tokens: 40 }
        })
      };
    };

    const provider = AIProviderFactory.create('anthropic', 'sk-ant-fake', 'claude-sonnet-4-20250514', { fetchImpl: mockFetch });
    const res = await provider.generateContent({
      contents: [{ role: 'user', parts: [{ text: '設九點鬧鐘' }] }],
      config: { systemInstruction: '你是奇異鳥' }
    });

    assert.strictEqual(capturedHeaders['x-api-key'], 'sk-ant-fake');
    assert.strictEqual(capturedHeaders['anthropic-version'], '2023-06-01');
    assert.strictEqual(res.text, '馬上處理！');
    assert.strictEqual(res.functionCalls.length, 1);
    assert.strictEqual(res.functionCalls[0].id, 'toolu_01');
    assert.deepStrictEqual(res.functionCalls[0].args, { time: '09:00' });
    assert.strictEqual(res.usageMetadata.totalTokenCount, 120);
  });
});
