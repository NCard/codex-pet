const fs = require('fs');
const { petStatePath: statePath, historyPath } = require('../../utils/paths');
const cryptoUtils = require('../../utils/crypto_utils');

class StateManager {
  constructor() {
    this.petState = {
      hunger: 100,
      mood: 100,
      outfits: [],
      outfitConfigs: {},
      todos: [],
      settings: {}
    };
  }

  loadPetState() {
    try {
      if (fs.existsSync(statePath)) {
        const data = fs.readFileSync(statePath, 'utf8');
        const parsedData = JSON.parse(data);
        // Preserve object reference for UI bindings
        Object.assign(this.petState, parsedData);
        
        if (this.petState.outfit !== undefined) {
          if (this.petState.outfit && typeof this.petState.outfit === 'string') {
            if (!this.petState.outfits) this.petState.outfits = [];
            if (!this.petState.outfits.includes(this.petState.outfit)) {
              this.petState.outfits.push(this.petState.outfit);
            }
          }
          delete this.petState.outfit;
        }
        
        if (!this.petState.outfits) this.petState.outfits = [];
        if (!this.petState.outfitConfigs) this.petState.outfitConfigs = {};
        
        // Migrate obsolete AI models to the lowest cost model (gemini-3.5-flash-lite)
        if (this.petState.settings && this.petState.settings.aiModel) {
          const obsoleteModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'];
          if (obsoleteModels.includes(this.petState.settings.aiModel)) {
            this.petState.settings.aiModel = 'gemini-3.5-flash-lite';
          }
        }
      }
    } catch (e) {
      console.error('載入寵物狀態失敗:', e);
    }
  }

  savePetState() {
    try {
      fs.writeFileSync(statePath, JSON.stringify(this.petState, null, 2), 'utf8');
    } catch (e) {
      console.error('儲存寵物狀態失敗:', e);
    }
  }

  saveChatHistory(role, message) {
    let history = [];
    try {
      if (fs.existsSync(historyPath)) {
        const data = fs.readFileSync(historyPath, 'utf8');
        if (data.trim() !== '') {
          try {
            const decrypted = cryptoUtils.decryptData(data);
            history = JSON.parse(decrypted);
          } catch (e) {
            history = JSON.parse(data);
          }
        }
      }
    } catch (e) {
      console.error('Failed to read history:', e);
    }

    history.push({
      role,
      message,
      timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    });

    try {
      const jsonStr = JSON.stringify(history, null, 2);
      const encryptedStr = cryptoUtils.encryptData(jsonStr);
      fs.writeFileSync(historyPath, encryptedStr, 'utf8');
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  clearChatHistory() {
    try {
      const encryptedStr = cryptoUtils.encryptData("[]");
      fs.writeFileSync(historyPath, encryptedStr, 'utf8');
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  }
}

module.exports = new StateManager();
