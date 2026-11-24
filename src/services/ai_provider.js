const { GoogleGenAI } = require('@google/genai');

class AIProvider {
  constructor(apiKey, modelName) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }
  
  /**
   * generateContent
   * @param {Object} options - Contains model, contents, and config.
   */
  async generateContent(options) {
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
  async testModelAvailability(_modelId) {
    throw new Error('Not implemented');
  }
}

class GeminiProvider extends AIProvider {
  constructor(apiKey, modelName) {
    super(apiKey, modelName);
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }
  
  async generateContent(options) {
    // If we need to override the model, we can do it here
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
            name: "ping",
            description: "Test ping function",
            parameters: { type: "object", properties: {} }
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
      let errMsg = err.message || String(err);
      let supportsTools = true;

      if (/TIMEOUT/i.test(errMsg)) {
        errMsg = `連線逾時 (超過 ${Math.round(timeoutMs / 1000)} 秒未回應)：Google 伺服器目前負載過高或未回應，請稍候再試`;
      } else if (/tool|function/i.test(errMsg)) {
        supportsTools = false;
        errMsg = '此模型不支援 Agent 工具呼叫 (Tool Calling)';
      } else if (/429|quota|resource_exhausted/i.test(errMsg)) {
        errMsg = '目前請求過於頻繁或免費額度暫時耗盡 (429 Rate Limit)';
      } else if (/404|not found/i.test(errMsg)) {
        errMsg = '模型不存在或已被 Google 官方下線 (404 Not Found)';
      } else if (/403|permission/i.test(errMsg)) {
        errMsg = 'API Key 權限不足或此模型需綁定付費帳單 (403 Forbidden)';
      } else if (/503|unavailable|high demand/i.test(errMsg)) {
        errMsg = 'Google 官方伺服器目前負載過高 (503 High Demand)，為暫時現象，請稍候再試';
      }

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
    
    // Helper function to process model
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
              ? `${Math.round(m.inputTokenLimit/1000000)}M`
              : `${Math.round(m.inputTokenLimit/1000)}k`;
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

class AIProviderFactory {
  static create(providerName, apiKey, modelName) {
    switch (providerName.toLowerCase()) {
      case 'gemini':
      default:
        return new GeminiProvider(apiKey, modelName);
    }
  }
}

module.exports = { AIProviderFactory, GeminiProvider, AIProvider };
