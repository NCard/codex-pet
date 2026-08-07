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
   * Returns an array of available model names.
   */
  async getAvailableModels() {
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

  async getAvailableModels() {
    const response = await this.client.models.list();
    let models = [];
    
    // Helper function to process model
    const processModel = (m) => {
      const methods = m.supportedActions || m.supportedGenerationMethods || [];
      const name = m.name;
      
      if (name.includes('gemini') && methods.includes('generateContent')) {
        // 排除特定測試、非對話模型、以及帶有特定版本號碼的分支 (如 -001)
        const excludePatterns = ['embedding', 'tts', 'image', 'video', 'aqa', 'veo', 'imagen', 'preview', 'exp', 'latest', 'robotics', 'computer-use', 'deep-research', '-001', '-002'];
        const shouldExclude = excludePatterns.some(pattern => name.includes(pattern));
        
        if (!shouldExclude) {
          let id = name;
          if (id.startsWith('models/')) id = id.replace('models/', '');
          
          let displayName = m.displayName || id;
          if (m.inputTokenLimit) {
            let limitStr = (m.inputTokenLimit >= 1000000) 
              ? `${Math.round(m.inputTokenLimit/1000000)}M`
              : `${Math.round(m.inputTokenLimit/1000)}k`;
            displayName += ` (${limitStr} ctx)`;
          }
          
          models.push({ id, displayName });
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
