const { GoogleGenAI } = require('@google/genai');

/**
 * 內建 AI 服務商預設清單 (Provider Presets)
 */
const PROVIDER_PRESETS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    protocol: 'gemini',
    baseUrl: '',
    requiresApiKey: true,
    allowCustomBaseUrl: false,
    defaultModel: 'gemini-3.5-flash-lite',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLinkText: '🌐 前往 Google AI Studio 取得金鑰 / 查看配額',
    keyPlaceholder: 'AIzaSy...',
    description: 'Google 官方模型，支援 1M 超長上下文與免費層額度。',
    defaultModels: [
      {
        id: 'gemini-3.5-flash-lite',
        displayName: 'Gemini 3.5 Flash Lite',
        description: '輕量高性價比模型，兼顧極速回應與工具自主調用能力。',
        contextStr: '1M Tokens',
        outputTokenLimit: 8192,
        badge: '推薦免費使用 (15 RPM)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash Lite',
        description: '穩定流暢的輕量主力模型，完整支援 Agent 工具呼叫。',
        contextStr: '1M Tokens',
        outputTokenLimit: 8192,
        badge: '推薦免費使用 (15 RPM)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq (高速免費額度)',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresApiKey: true,
    allowCustomBaseUrl: false,
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    keyLinkText: '🌐 前往 Groq Console 取得免費 API Key',
    keyPlaceholder: 'gsk_...',
    description: 'LPU 硬體極速推論，免費額度大方（每日 14,400 次起），完整支援 Agent 工具呼叫。',
    defaultModels: [
      {
        id: 'llama-3.3-70b-versatile',
        displayName: 'Llama 3.3 70B Versatile',
        description: 'Groq 旗艦主力開源模型，中文理解佳、速度極快且穩定支援工具調用。',
        contextStr: '128k Tokens',
        outputTokenLimit: 32768,
        badge: '推薦高速免費 (30 RPM)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'llama-3.1-8b-instant',
        displayName: 'Llama 3.1 8B Instant',
        description: '超低延遲輕量模型，適合快速日常互動與高頻率對話。',
        contextStr: '128k Tokens',
        outputTokenLimit: 8192,
        badge: '極速輕量 (30 RPM)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'qwen/qwen3-32b',
        displayName: 'Qwen 3 32B',
        description: '通義千問世代模型，具備優異繁體中文能力與多步推理。',
        contextStr: '128k Tokens',
        outputTokenLimit: 8192,
        badge: '中文強化 (30 RPM)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (多模型聚合)',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    allowCustomBaseUrl: false,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    keyLinkText: '🌐 前往 OpenRouter 取得 API Key / 查看免費模型',
    keyPlaceholder: 'sk-or-v1-...',
    description: '單一金鑰通吃全球各大廠模型，並提供多款帶有 :free 標籤的免費模型。',
    defaultModels: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        displayName: 'Llama 3.3 70B Instruct (:free)',
        description: 'OpenRouter 免費旗艦模型，支援工具調用與多語言對話。',
        contextStr: '128k Tokens',
        outputTokenLimit: 8192,
        badge: '免費聚合 (:free)',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'google/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash (via OpenRouter)',
        description: '透過 OpenRouter 穩定路由存取 Gemini 2.5 Flash。',
        contextStr: '1M Tokens',
        outputTokenLimit: 8192,
        badge: 'OpenRouter 路由',
        tier: 'flash',
        isRecommended: false,
        supportsTools: true
      },
      {
        id: 'openai/gpt-4o-mini',
        displayName: 'GPT-4o Mini (via OpenRouter)',
        description: '透過 OpenRouter 存取 OpenAI 輕量主力模型。',
        contextStr: '128k Tokens',
        outputTokenLimit: 16384,
        badge: 'OpenRouter 路由',
        tier: 'flash',
        isRecommended: false,
        supportsTools: true
      }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    allowCustomBaseUrl: true,
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLinkText: '🌐 前往 OpenAI Platform 管理 API Key',
    keyPlaceholder: 'sk-...',
    description: 'OpenAI 官方 GPT 系列，穩定度與 Agent 工具呼叫準確率極高。',
    defaultModels: [
      {
        id: 'gpt-4o-mini',
        displayName: 'GPT-4o mini',
        description: '高性價比主力模型，反應快速且精準支援 Function Calling。',
        contextStr: '128k Tokens',
        outputTokenLimit: 16384,
        badge: '推薦主力',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        description: 'OpenAI 旗艦多模態主力模型，處理複雜多步任務表現優異。',
        contextStr: '128k Tokens',
        outputTokenLimit: 16384,
        badge: '深度旗艦',
        tier: 'pro',
        isRecommended: false,
        supportsTools: true
      },
      {
        id: 'gpt-4.1-mini',
        displayName: 'GPT-4.1 mini',
        description: '新一代長上下文高效模型，工具呼叫更精準。',
        contextStr: '1M Tokens',
        outputTokenLimit: 32768,
        badge: '推薦主力',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      }
    ]
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    allowCustomBaseUrl: false,
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyLinkText: '🌐 前往 DeepSeek 開放平台取得金鑰',
    keyPlaceholder: 'sk-...',
    description: '極高性價比的中文與推理模型，原生相容 OpenAI 格式。',
    defaultModels: [
      {
        id: 'deepseek-chat',
        displayName: 'DeepSeek Chat (V3)',
        description: '通用主力模型，中文流暢且支援 Agent 工具呼叫。',
        contextStr: '64k Tokens',
        outputTokenLimit: 8192,
        badge: '推薦主力',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'deepseek-reasoner',
        displayName: 'DeepSeek Reasoner (R1)',
        description: '深度推理思考模型，適合複雜邏輯問題（工具支援視版本而定）。',
        contextStr: '64k Tokens',
        outputTokenLimit: 8192,
        badge: '深度旗艦',
        tier: 'pro',
        isRecommended: false,
        supportsTools: true
      }
    ]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    allowCustomBaseUrl: true,
    defaultModel: 'claude-sonnet-4-20250514',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLinkText: '🌐 前往 Anthropic Console 管理 API Key',
    keyPlaceholder: 'sk-ant-...',
    description: 'Anthropic 官方 Claude 系列，自然語氣、長文理解與工具執行極為精準。',
    defaultModels: [
      {
        id: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        description: '智慧與速度完美平衡的主力模型，Agent 工具能力極強。',
        contextStr: '200k Tokens',
        outputTokenLimit: 8192,
        badge: '推薦主力',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: '極速輕量 Claude 模型，低延遲、低成本，適合日常桌寵對話。',
        contextStr: '200k Tokens',
        outputTokenLimit: 8192,
        badge: '極速輕量',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'claude-3-7-sonnet-20250219',
        displayName: 'Claude 3.7 Sonnet',
        description: '支援混合推理思考的高階模型，擅長複雜規劃任務。',
        contextStr: '200k Tokens',
        outputTokenLimit: 8192,
        badge: '深度旗艦',
        tier: 'pro',
        isRecommended: false,
        supportsTools: true
      }
    ]
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (本機離線免費)',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    allowCustomBaseUrl: true,
    defaultModel: 'llama3.2',
    keyUrl: 'https://ollama.com',
    keyLinkText: '🌐 前往 Ollama 官網下載本機模型引擎',
    keyPlaceholder: '本機無需 API Key（可留空）',
    description: '運行於您自己電腦上的本機開源模型，完全免費、無額度限制且 100% 離線隱私。',
    defaultModels: [
      {
        id: 'llama3.2',
        displayName: 'Llama 3.2 (Local)',
        description: '輕量本機模型，支援工具調用（請先執行 ollama pull llama3.2）。',
        contextStr: '128k Tokens',
        outputTokenLimit: 8192,
        badge: '本機免費無上限',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      },
      {
        id: 'qwen2.5:7b',
        displayName: 'Qwen 2.5 7B (Local)',
        description: '繁體中文極佳的本機模型，支援工具調用（ollama pull qwen2.5:7b）。',
        contextStr: '32k Tokens',
        outputTokenLimit: 8192,
        badge: '本機中文推薦',
        tier: 'flash',
        isRecommended: true,
        supportsTools: true
      }
    ]
  },
  custom: {
    id: 'custom',
    name: '自訂 OpenAI 相容端點',
    protocol: 'openai',
    baseUrl: '',
    requiresApiKey: false,
    allowCustomBaseUrl: true,
    defaultModel: '',
    keyUrl: '',
    keyLinkText: '',
    keyPlaceholder: '依自訂端點需求填寫 API Key（可留空）',
    description: '支援 LM Studio、vLLM、One-API、Azure Proxy 等任何相容 OpenAI Chat Completions 規範的服務。',
    defaultModels: []
  }
};

/**
 * 清理 JSON Schema 以符合 OpenAI / Anthropic 工具規範
 */
function sanitizeJsonSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }
  const cloned = Array.isArray(schema) ? schema.map(sanitizeJsonSchema) : { ...schema };
  if (!Array.isArray(cloned)) {
    if (typeof cloned.type === 'string') {
      cloned.type = cloned.type.toLowerCase();
    }
    if (cloned.type === 'object' && !cloned.properties) {
      cloned.properties = {};
    }
    if (cloned.properties && typeof cloned.properties === 'object') {
      const nextProps = {};
      for (const [k, v] of Object.entries(cloned.properties)) {
        nextProps[k] = sanitizeJsonSchema(v);
      }
      cloned.properties = nextProps;
    }
    if (cloned.items) {
      cloned.items = sanitizeJsonSchema(cloned.items);
    }
  }
  return cloned;
}

/**
 * 將 Gemini tools ([{ functionDeclarations }]) 轉譯為 OpenAI tools 格式
 */
function convertGeminiToolsToOpenAITools(geminiTools) {
  if (!Array.isArray(geminiTools) || geminiTools.length === 0) return undefined;
  const openAiTools = [];
  for (const group of geminiTools) {
    const declarations = group?.functionDeclarations || [];
    for (const fn of declarations) {
      if (!fn || !fn.name) continue;
      openAiTools.push({
        type: 'function',
        function: {
          name: fn.name,
          description: fn.description || '',
          parameters: sanitizeJsonSchema(fn.parameters || { type: 'object', properties: {} })
        }
      });
    }
  }
  return openAiTools.length > 0 ? openAiTools : undefined;
}

/**
 * 將 Gemini contents 與 systemInstruction 轉譯為 OpenAI messages 格式
 */
function convertGeminiContentsToOpenAIMessages(contents, systemInstruction = '') {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
    return messages;
  }
  if (!Array.isArray(contents)) return messages;

  let fallbackCallCounter = 0;

  for (const entry of contents) {
    if (!entry) continue;
    const role = entry.role === 'model' ? 'assistant' : (entry.role || 'user');
    const parts = Array.isArray(entry.parts) ? entry.parts : [];

    if (role === 'user') {
      const fnResponses = parts.filter(p => p && p.functionResponse);
      const textParts = parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text);

      for (const p of fnResponses) {
        const fr = p.functionResponse;
        const contentStr = typeof fr.response === 'string'
          ? fr.response
          : JSON.stringify(fr.response ?? {});
        messages.push({
          role: 'tool',
          tool_call_id: fr.id || `call_${fr.name || 'fn'}`,
          name: fr.name || 'tool',
          content: contentStr
        });
      }

      if (textParts.length > 0) {
        messages.push({ role: 'user', content: textParts.join('\n') });
      }
    } else if (role === 'assistant') {
      const textParts = parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text);
      const fnCalls = parts.filter(p => p && p.functionCall).map(p => p.functionCall);

      const assistantMsg = {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.join('\n') : (fnCalls.length > 0 ? null : '')
      };

      if (fnCalls.length > 0) {
        assistantMsg.tool_calls = fnCalls.map(fc => {
          fallbackCallCounter += 1;
          return {
            id: fc.id || `call_${fc.name || 'fn'}_${fallbackCallCounter}`,
            type: 'function',
            function: {
              name: fc.name,
              arguments: typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args || {})
            }
          };
        });
      }
      messages.push(assistantMsg);
    } else if (role === 'system') {
      const text = parts.map(p => p?.text || '').filter(Boolean).join('\n');
      if (text) messages.push({ role: 'system', content: text });
    }
  }

  return messages;
}

/**
 * 將 Gemini tools 轉譯為 Anthropic tools 格式
 */
function convertGeminiToolsToAnthropicTools(geminiTools) {
  if (!Array.isArray(geminiTools) || geminiTools.length === 0) return undefined;
  const tools = [];
  for (const group of geminiTools) {
    const declarations = group?.functionDeclarations || [];
    for (const fn of declarations) {
      if (!fn || !fn.name) continue;
      tools.push({
        name: fn.name,
        description: fn.description || '',
        input_schema: sanitizeJsonSchema(fn.parameters || { type: 'object', properties: {} })
      });
    }
  }
  return tools.length > 0 ? tools : undefined;
}

/**
 * 將 Gemini contents 轉譯為 Anthropic messages 格式
 */
function convertGeminiContentsToAnthropicMessages(contents) {
  const messages = [];
  if (typeof contents === 'string') {
    return [{ role: 'user', content: contents }];
  }
  if (!Array.isArray(contents)) return messages;

  let fallbackCallCounter = 0;

  for (const entry of contents) {
    if (!entry) continue;
    const role = entry.role === 'model' ? 'assistant' : 'user';
    const parts = Array.isArray(entry.parts) ? entry.parts : [];
    const blocks = [];

    for (const p of parts) {
      if (!p || p.thought) continue;
      if (typeof p.text === 'string' && p.text.length > 0) {
        blocks.push({ type: 'text', text: p.text });
      } else if (p.functionCall) {
        fallbackCallCounter += 1;
        blocks.push({
          type: 'tool_use',
          id: p.functionCall.id || `toolu_${p.functionCall.name || 'fn'}_${fallbackCallCounter}`,
          name: p.functionCall.name,
          input: p.functionCall.args || {}
        });
      } else if (p.functionResponse) {
        const fr = p.functionResponse;
        const contentStr = typeof fr.response === 'string'
          ? fr.response
          : JSON.stringify(fr.response ?? {});
        blocks.push({
          type: 'tool_result',
          tool_use_id: fr.id || `toolu_${fr.name || 'fn'}`,
          content: contentStr
        });
      }
    }

    if (blocks.length > 0) {
      // 合併相同連續角色以符合 Anthropic 嚴格交替規範
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        const prev = messages[messages.length - 1];
        if (typeof prev.content === 'string') {
          prev.content = [{ type: 'text', text: prev.content }, ...blocks];
        } else {
          prev.content.push(...blocks);
        }
      } else {
        messages.push({ role, content: blocks });
      }
    }
  }

  return messages;
}

/**
 * 格式化上下文長度字串
 */
function formatContextLength(num) {
  if (!num || typeof num !== 'number') return '';
  if (num >= 1000000) return `${Math.round(num / 1000000)}M Tokens`;
  return `${Math.round(num / 1000)}k Tokens`;
}

/**
 * 統一翻譯常見 HTTP / 網路錯誤訊息為繁體中文提示
 */
function classifyProviderError(err, { timeoutMs = 10000, providerId = '', baseUrl = '' } = {}) {
  const rawMsg = err?.message || String(err);
  let errMsg = rawMsg;
  let supportsTools = true;

  if (/TIMEOUT|AbortError|aborted/i.test(rawMsg)) {
    errMsg = `連線逾時 (超過 ${Math.round(timeoutMs / 1000)} 秒未回應)：伺服器目前負載過高或未回應，請稍候再試`;
  } else if (/ECONNREFUSED|fetch failed|Failed to fetch|ENOTFOUND/i.test(rawMsg)) {
    if (providerId === 'ollama' || (baseUrl && baseUrl.includes('localhost'))) {
      errMsg = `無法連線至本機端點 (${baseUrl || 'http://localhost:11434/v1'})：請確認 Ollama / 本機引擎已啟動`;
    } else {
      errMsg = `網路連線失敗：請檢查網路狀態或 Base URL 是否正確 (${rawMsg})`;
    }
  } else if (/tool|function_call|function calling|tools are not supported/i.test(rawMsg)) {
    supportsTools = false;
    errMsg = '此模型不支援 Agent 工具呼叫 (Tool Calling)';
  } else if (/401|invalid.*api.*key|unauthorized|authentication|incorrect api key/i.test(rawMsg)) {
    errMsg = 'API Key 無效或未授權，請檢查金鑰是否填寫正確 (401 Unauthorized)';
  } else if (/402|insufficient.*balance|credit|billing|payment/i.test(rawMsg)) {
    errMsg = '帳戶餘額不足或需先儲值啟用 API (402 Insufficient Balance)';
  } else if (/429|quota|resource_exhausted|rate.?limit/i.test(rawMsg)) {
    errMsg = '目前請求過於頻繁或額度暫時耗盡 (429 Rate Limit)';
  } else if (/404|not found|does not exist/i.test(rawMsg)) {
    errMsg = '模型不存在、名稱錯誤或端點路徑不正確 (404 Not Found)';
  } else if (/403|permission|forbidden/i.test(rawMsg)) {
    errMsg = 'API Key 權限不足或此模型需升級付費方案 (403 Forbidden)';
  } else if (/503|502|unavailable|high demand|overloaded/i.test(rawMsg)) {
    errMsg = '官方伺服器目前負載過高或暫時維護中 (503 Service Unavailable)，請稍候再試';
  }

  return { errMsg, supportsTools };
}

class AIProvider {
  constructor(apiKey, modelName, options = {}) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.providerId = options.providerId || 'gemini';
    this.baseUrl = options.baseUrl || '';
    this.fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  /**
   * generateContent
   * @param {Object} options - Contains model, contents, and config.
   */
  async generateContent(_options) {
    throw new Error('Not implemented');
  }

  /**
   * getAvailableModels
   * Returns an array of available model objects with metadata.
   */
  async getAvailableModels() {
    throw new Error('Not implemented');
  }

  /**
   * testModelAvailability
   * Tests if the given model can respond and supports tools.
   */
  async testModelAvailability(_modelId, _timeoutMs = 10000) {
    throw new Error('Not implemented');
  }
}

class GeminiProvider extends AIProvider {
  constructor(apiKey, modelName, options = {}) {
    super(apiKey, modelName, { ...options, providerId: 'gemini' });
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generateContent(options) {
    if (this.modelName) {
      options.model = this.modelName;
    }
    return await this.client.models.generateContent(options);
  }

  async testModelAvailability(modelId, timeoutMs = 10000) {
    const targetModel = modelId || this.modelName;
    if (!targetModel) {
      return { success: false, latencyMs: 0, error: '未指定測試模型名稱', supportsTools: false };
    }
    const startTime = Date.now();
    let timer = null;
    try {
      const testTool = {
        functionDeclarations: [
          {
            name: 'ping',
            description: 'Test ping function',
            parameters: { type: 'object', properties: {} }
          }
        ]
      };

      const requestPromise = this.client.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: 'Ping! 請回答 Pong' }] }],
        config: {
          tools: [testTool],
          temperature: 0.1,
          maxOutputTokens: 20
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`TIMEOUT: 請求逾時 (超過 ${Math.round(timeoutMs / 1000)} 秒未回應)`));
        }, timeoutMs);
      });

      const response = await Promise.race([requestPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      const latencyMs = Date.now() - startTime;
      const text = response?.text || '';
      return {
        success: true,
        latencyMs,
        supportsTools: true,
        reply: text.trim()
      };
    } catch (err) {
      if (timer) clearTimeout(timer);
      const latencyMs = Date.now() - startTime;
      const { errMsg, supportsTools } = classifyProviderError(err, {
        timeoutMs,
        providerId: 'gemini'
      });

      return {
        success: false,
        latencyMs,
        error: errMsg,
        supportsTools
      };
    }
  }

  async getAvailableModels() {
    const response = await this.client.models.list();
    const models = [];

    const processModel = (m) => {
      const methods = m.supportedActions || m.supportedGenerationMethods || [];
      const name = m.name;

      if (name.includes('gemini') && methods.includes('generateContent')) {
        // 排除特定測試、非對話模型、語音轉錄、邊緣設備模型以及帶有特定版本號碼的分支 (如 -001)
        const excludePatterns = ['embedding', 'tts', 'image', 'video', 'aqa', 'veo', 'imagen', 'preview', 'exp', 'latest', 'robotics', 'computer-use', 'deep-research', 'transcribe', 'nano', '-001', '-002'];
        const shouldExclude = excludePatterns.some(pattern => name.includes(pattern));

        if (!shouldExclude) {
          let id = name;
          if (id.startsWith('models/')) id = id.replace('models/', '');

          let displayName = m.displayName || id;
          let limitStr = '';
          if (m.inputTokenLimit) {
            limitStr = (m.inputTokenLimit >= 1000000)
              ? `${Math.round(m.inputTokenLimit / 1000000)}M`
              : `${Math.round(m.inputTokenLimit / 1000)}k`;
            displayName += ` (${limitStr} ctx)`;
          }

          const description = m.description || '';
          const inputTokenLimit = m.inputTokenLimit || null;
          const outputTokenLimit = m.outputTokenLimit || null;

          const lowerId = id.toLowerCase();
          const isPro = lowerId.includes('pro');
          const isFlash = lowerId.includes('flash') || lowerId.includes('lite');
          const isLegacy = lowerId.includes('1.0') || lowerId.includes('gemini-pro');

          let badge = '';
          let tier = 'standard';
          let isRecommended = false;
          let supportsTools = true;

          if (isLegacy) {
            badge = '舊版 / 限制多';
            supportsTools = false;
            tier = 'legacy';
          } else if (isFlash) {
            badge = '推薦免費使用 (15 RPM)';
            isRecommended = true;
            tier = 'flash';
          } else if (isPro) {
            badge = '深度旗艦 (2 RPM)';
            tier = 'pro';
          }

          models.push({
            id,
            displayName,
            description,
            inputTokenLimit,
            outputTokenLimit,
            contextStr: limitStr ? `${limitStr} Tokens` : '',
            badge,
            tier,
            isRecommended,
            supportsTools
          });
        }
      }
    };

    if (response.data && Array.isArray(response.data)) {
      response.data.forEach(processModel);
    } else {
      for await (const m of response) {
        processModel(m);
      }
    }
    return models;
  }
}

/**
 * 通用 OpenAI 相容協議 Provider
 * 支援 OpenAI、Groq、OpenRouter、DeepSeek、Ollama、LM Studio 與任何自訂端點
 */
class OpenAICompatibleProvider extends AIProvider {
  constructor(apiKey, modelName, options = {}) {
    const providerId = (options.providerId || 'openai').toLowerCase();
    const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.custom;
    const rawBaseUrl = (options.baseUrl || preset.baseUrl || '').trim();
    const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
    super(apiKey, modelName, {
      ...options,
      providerId,
      baseUrl: normalizedBaseUrl
    });
    this.preset = preset;
  }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.providerId === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/NCard/codex-pet';
      headers['X-Title'] = 'Wiki Wiki Desktop Pet';
    }
    return headers;
  }

  async _fetchJson(url, fetchOptions = {}, timeoutMs = 60000) {
    if (!this.fetchImpl) {
      throw new Error('當前執行環境不支援 fetch API');
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    if (controller && timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      const res = await this.fetchImpl(url, {
        ...fetchOptions,
        signal: controller ? controller.signal : undefined
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { raw: text };
      }

      if (!res.ok) {
        const apiErrMsg = data?.error?.message || data?.message || text || res.statusText;
        const err = new Error(`HTTP ${res.status}: ${apiErrMsg}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(`TIMEOUT: 請求逾時 (超過 ${Math.round(timeoutMs / 1000)} 秒未回應)`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async generateContent(options = {}, requestTimeoutMs = 60000) {
    if (!this.baseUrl) {
      throw new Error('請先填寫服務商的 Base URL 端點網址');
    }
    const model = this.modelName || options.model;
    if (!model) {
      throw new Error('尚未指定 AI 模型名稱');
    }

    const config = options.config || {};
    const messages = convertGeminiContentsToOpenAIMessages(options.contents, config.systemInstruction);
    const tools = convertGeminiToolsToOpenAITools(config.tools);

    const body = {
      model,
      messages
    };
    if (typeof config.temperature === 'number') {
      body.temperature = config.temperature;
    }
    if (typeof config.maxOutputTokens === 'number') {
      body.max_tokens = config.maxOutputTokens;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const data = await this._fetchJson(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(body)
      },
      requestTimeoutMs
    );

    const choice = data?.choices?.[0] || {};
    const msg = choice.message || {};
    const parts = [];
    const functionCalls = [];

    if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
      parts.push({ thought: true, text: msg.reasoning_content });
    }
    if (typeof msg.content === 'string' && msg.content.length > 0) {
      parts.push({ text: msg.content });
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const fnName = tc?.function?.name;
        if (!fnName) continue;
        let parsedArgs = {};
        if (typeof tc.function.arguments === 'string' && tc.function.arguments.trim()) {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch (_) {
            parsedArgs = {};
          }
        } else if (tc.function.arguments && typeof tc.function.arguments === 'object') {
          parsedArgs = tc.function.arguments;
        }
        const fcObj = {
          id: tc.id || `call_${fnName}`,
          name: fnName,
          args: parsedArgs
        };
        functionCalls.push(fcObj);
        parts.push({ functionCall: fcObj });
      }
    }

    const promptTokens = data?.usage?.prompt_tokens || 0;
    const completionTokens = data?.usage?.completion_tokens || 0;
    const totalTokens = data?.usage?.total_tokens || (promptTokens + completionTokens);

    return {
      text: typeof msg.content === 'string' ? msg.content : '',
      functionCalls,
      candidates: [
        {
          content: {
            role: 'model',
            parts
          }
        }
      ],
      usageMetadata: {
        promptTokenCount: promptTokens,
        candidatesTokenCount: completionTokens,
        totalTokenCount: totalTokens
      }
    };
  }

  async testModelAvailability(modelId, timeoutMs = 10000) {
    const targetModel = modelId || this.modelName;
    if (!targetModel) {
      return { success: false, latencyMs: 0, error: '未指定測試模型名稱', supportsTools: false };
    }
    const startTime = Date.now();
    const prevModel = this.modelName;
    this.modelName = targetModel;
    try {
      const testTool = {
        functionDeclarations: [
          {
            name: 'ping',
            description: 'Test ping function',
            parameters: { type: 'object', properties: {} }
          }
        ]
      };

      const response = await this.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: 'Ping! 請直接簡短回答 Pong' }] }],
        config: {
          tools: [testTool],
          temperature: 0.1,
          maxOutputTokens: 20
        }
      }, timeoutMs);

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        supportsTools: true,
        reply: (response?.text || '').trim()
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const { errMsg, supportsTools } = classifyProviderError(err, {
        timeoutMs,
        providerId: this.providerId,
        baseUrl: this.baseUrl
      });
      return {
        success: false,
        latencyMs,
        error: errMsg,
        supportsTools
      };
    } finally {
      this.modelName = prevModel;
    }
  }

  async getAvailableModels() {
    if (!this.baseUrl) {
      return [...(this.preset.defaultModels || [])];
    }

    const data = await this._fetchJson(
      `${this.baseUrl}/models`,
      {
        method: 'GET',
        headers: this._buildHeaders()
      },
      12000
    );

    const rawList = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
    const excludePatterns = ['embedding', 'whisper', 'tts', 'dall-e', 'moderation', 'realtime', 'audio', 'sora', 'guard', 'transcribe', 'babbage', 'davinci'];

    const models = [];
    for (const item of rawList) {
      const id = item?.id || item?.name;
      if (!id || typeof id !== 'string') continue;
      const lower = id.toLowerCase();
      if (excludePatterns.some(p => lower.includes(p))) continue;

      const ctxLen = item.context_length || item.context_window || item.max_model_len || null;
      const ctxStr = formatContextLength(ctxLen);
      const outLimit = item.top_provider?.max_completion_tokens || item.max_output_tokens || null;
      const isFree = lower.includes(':free') || this.providerId === 'ollama' || this.providerId === 'groq';
      const isPro = lower.includes('pro') || lower.includes('opus') || lower.includes('reasoner') || lower.includes('o1') || lower.includes('o3') || lower.includes('70b');

      let badge = this.preset.name.split(' ')[0];
      let tier = 'flash';
      if (this.providerId === 'ollama') {
        badge = '本機免費無上限';
        tier = 'flash';
      } else if (lower.includes(':free')) {
        badge = '免費聚合 (:free)';
        tier = 'flash';
      } else if (this.providerId === 'groq') {
        badge = '高速免費 (30 RPM)';
        tier = 'flash';
      } else if (isPro) {
        badge = '深度旗艦';
        tier = 'pro';
      } else {
        badge = '標準對話模型';
        tier = 'flash';
      }

      models.push({
        id,
        displayName: item.name && item.name !== id ? `${item.name}${ctxStr ? ` (${ctxStr.replace(' Tokens', ' ctx')})` : ''}` : `${id}${ctxStr ? ` (${ctxStr.replace(' Tokens', ' ctx')})` : ''}`,
        description: item.description || `${this.preset.name} 對話與工具模型。`,
        inputTokenLimit: ctxLen,
        outputTokenLimit: outLimit,
        contextStr: ctxStr || '標準上下文',
        badge,
        tier,
        isRecommended: isFree,
        supportsTools: true
      });
    }

    // OpenRouter 將 :free 模型優先排前，避免清單過長難找
    if (this.providerId === 'openrouter') {
      models.sort((a, b) => {
        const aFree = a.id.includes(':free') ? 0 : 1;
        const bFree = b.id.includes(':free') ? 0 : 1;
        if (aFree !== bFree) return aFree - bFree;
        return a.id.localeCompare(b.id);
      });
    }

    if (models.length === 0 && this.preset.defaultModels?.length > 0) {
      return [...this.preset.defaultModels];
    }

    return models;
  }
}

/**
 * Anthropic Claude 原生 API Provider
 */
class AnthropicProvider extends AIProvider {
  constructor(apiKey, modelName, options = {}) {
    const preset = PROVIDER_PRESETS.anthropic;
    const rawBaseUrl = (options.baseUrl || preset.baseUrl).trim();
    super(apiKey, modelName, {
      ...options,
      providerId: 'anthropic',
      baseUrl: rawBaseUrl.replace(/\/+$/, '')
    });
    this.preset = preset;
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey || '',
      'anthropic-version': '2023-06-01'
    };
  }

  async _fetchJson(url, fetchOptions = {}, timeoutMs = 60000) {
    if (!this.fetchImpl) {
      throw new Error('當前執行環境不支援 fetch API');
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    if (controller && timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      const res = await this.fetchImpl(url, {
        ...fetchOptions,
        signal: controller ? controller.signal : undefined
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = { raw: text };
      }

      if (!res.ok) {
        const apiErrMsg = data?.error?.message || data?.message || text || res.statusText;
        const err = new Error(`HTTP ${res.status}: ${apiErrMsg}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(`TIMEOUT: 請求逾時 (超過 ${Math.round(timeoutMs / 1000)} 秒未回應)`);
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async generateContent(options = {}, requestTimeoutMs = 60000) {
    const model = this.modelName || options.model;
    if (!model) {
      throw new Error('尚未指定 Claude 模型名稱');
    }
    const config = options.config || {};
    const messages = convertGeminiContentsToAnthropicMessages(options.contents);
    const tools = convertGeminiToolsToAnthropicTools(config.tools);

    const body = {
      model,
      max_tokens: config.maxOutputTokens || 4096,
      messages
    };
    if (config.systemInstruction) {
      body.system = config.systemInstruction;
    }
    if (typeof config.temperature === 'number') {
      body.temperature = config.temperature;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const data = await this._fetchJson(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(body)
      },
      requestTimeoutMs
    );

    const contentBlocks = Array.isArray(data?.content) ? data.content : [];
    const parts = [];
    const functionCalls = [];
    const textPieces = [];

    for (const block of contentBlocks) {
      if (!block) continue;
      if (block.type === 'thinking' && block.thinking) {
        parts.push({ thought: true, text: block.thinking });
      } else if (block.type === 'text' && typeof block.text === 'string') {
        textPieces.push(block.text);
        parts.push({ text: block.text });
      } else if (block.type === 'tool_use' && block.name) {
        const fcObj = {
          id: block.id || `toolu_${block.name}`,
          name: block.name,
          args: block.input || {}
        };
        functionCalls.push(fcObj);
        parts.push({ functionCall: fcObj });
      }
    }

    const inputTokens = data?.usage?.input_tokens || 0;
    const outputTokens = data?.usage?.output_tokens || 0;

    return {
      text: textPieces.join('\n'),
      functionCalls,
      candidates: [
        {
          content: {
            role: 'model',
            parts
          }
        }
      ],
      usageMetadata: {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        totalTokenCount: inputTokens + outputTokens
      }
    };
  }

  async testModelAvailability(modelId, timeoutMs = 10000) {
    const targetModel = modelId || this.modelName;
    if (!targetModel) {
      return { success: false, latencyMs: 0, error: '未指定測試模型名稱', supportsTools: false };
    }
    const startTime = Date.now();
    const prevModel = this.modelName;
    this.modelName = targetModel;
    try {
      const testTool = {
        functionDeclarations: [
          {
            name: 'ping',
            description: 'Test ping function',
            parameters: { type: 'object', properties: {} }
          }
        ]
      };

      const response = await this.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: 'Ping! 請直接簡短回答 Pong' }] }],
        config: {
          tools: [testTool],
          temperature: 0.1,
          maxOutputTokens: 20
        }
      }, timeoutMs);

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        supportsTools: true,
        reply: (response?.text || '').trim()
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const { errMsg, supportsTools } = classifyProviderError(err, {
        timeoutMs,
        providerId: 'anthropic',
        baseUrl: this.baseUrl
      });
      return {
        success: false,
        latencyMs,
        error: errMsg,
        supportsTools
      };
    } finally {
      this.modelName = prevModel;
    }
  }

  async getAvailableModels() {
    try {
      const data = await this._fetchJson(
        `${this.baseUrl}/models`,
        {
          method: 'GET',
          headers: this._buildHeaders()
        },
        10000
      );
      const rawList = Array.isArray(data?.data) ? data.data : [];
      if (rawList.length > 0) {
        return rawList.map(m => {
          const isPro = /opus|sonnet/i.test(m.id);
          return {
            id: m.id,
            displayName: m.display_name || m.id,
            description: 'Anthropic 官方 Claude 模型，支援長文脈絡與精準工具調用。',
            inputTokenLimit: 200000,
            outputTokenLimit: 8192,
            contextStr: '200k Tokens',
            badge: isPro ? 'Claude 旗艦' : 'Claude 極速',
            tier: /opus/i.test(m.id) ? 'pro' : 'flash',
            isRecommended: /sonnet|haiku/i.test(m.id),
            supportsTools: true
          };
        });
      }
    } catch (_) {
      // 若端點不支援 /models 或離線，退回內建常用 Claude 清單
    }
    return [...this.preset.defaultModels];
  }
}

class AIProviderFactory {
  static getPresets() {
    return PROVIDER_PRESETS;
  }

  static getPreset(providerName = 'gemini') {
    const key = (providerName || 'gemini').toLowerCase();
    return PROVIDER_PRESETS[key] || PROVIDER_PRESETS.gemini;
  }

  static create(providerName, apiKey, modelName, options = {}) {
    const key = (providerName || 'gemini').toLowerCase();
    switch (key) {
      case 'gemini':
        return new GeminiProvider(apiKey, modelName, options);
      case 'anthropic':
        return new AnthropicProvider(apiKey, modelName, options);
      case 'openai':
      case 'groq':
      case 'openrouter':
      case 'deepseek':
      case 'ollama':
      case 'custom':
        return new OpenAICompatibleProvider(apiKey, modelName, {
          ...options,
          providerId: key
        });
      default:
        return new GeminiProvider(apiKey, modelName, options);
    }
  }
}

module.exports = {
  AIProviderFactory,
  GeminiProvider,
  OpenAICompatibleProvider,
  AnthropicProvider,
  AIProvider,
  PROVIDER_PRESETS,
  convertGeminiContentsToOpenAIMessages,
  convertGeminiToolsToOpenAITools,
  convertGeminiContentsToAnthropicMessages,
  convertGeminiToolsToAnthropicTools
};
