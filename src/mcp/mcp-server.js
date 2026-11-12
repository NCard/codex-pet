require('../utils/logger');
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const fs = require('fs');
const path = require('path');

const server = new Server(
  {
    name: "wiki-wiki-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper functions for reading/writing states
const { petStatePath, alarmsPath } = require('../utils/paths');

function getPetState() {
  if (fs.existsSync(petStatePath)) {
    try {
      return JSON.parse(fs.readFileSync(petStatePath, 'utf8'));
    } catch (e) {}
  }
  return { hunger: 100, mood: 100, todos: [], outfit: '', outfitConfigs: {} };
}

function savePetState(state) {
  fs.writeFileSync(petStatePath, JSON.stringify(state, null, 2));
}

function getAlarms() {
  if (fs.existsSync(alarmsPath)) {
    try {
      return JSON.parse(fs.readFileSync(alarmsPath, 'utf8'));
    } catch (e) {}
  }
  return [];
}

function saveAlarms(alarms) {
  fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2));
}

// 註冊 Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_todo",
        description: "新增一個待辦事項",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "待辦事項的內容，例如 '買晚餐'" },
            reminderTime: { type: "string", description: "提醒時間，格式為 HH:MM，例如 '18:30'。如果不需提醒則留空。" }
          },
          required: ["text"],
        },
      },
      {
        name: "add_alarm",
        description: "新增一個鬧鐘",
        inputSchema: {
          type: "object",
          properties: {
            time: { type: "string", description: "鬧鐘時間，格式為 HH:MM，例如 '08:00'" },
            message: { type: "string", description: "鬧鐘標籤或提醒內容，例如 '起床'" }
          },
          required: ["time", "message"],
        },
      },
      {
        name: "change_outfit",
        description: "為寵物更換、穿戴或脫下服飾配件。可依語意選擇合適的 mode。",
        inputSchema: {
          type: "object",
          properties: {
            outfit: {
              type: "string",
              description: "服飾的 emoji，支援 '🎩', '🕶️', '🎀', '👑', '🌸', '🎓', '🎃', '🎉', '🥽'。若要脫下所有服飾，請傳入空字串 ''"
            },
            mode: {
              type: "string",
              enum: ["add", "replace", "remove", "clear"],
              description: "更換模式（務必依使用者語意選擇）：\n- 'add': 使用者說「戴上/穿上/加上XX」時使用，保留原有飾品並疊加新飾品。\n- 'replace': 使用者說「換成XX/只戴XX/改戴XX」時使用，移除其他飾品並僅保留該飾品。\n- 'remove': 使用者說「脫下/摘掉/拿下XX」時使用，只移除該特定飾品。\n- 'clear': 使用者說「脫掉全部/不穿了/全身脫光」時使用，清空所有飾品。"
            }
          },
          required: ["outfit"],
        },
      },
      {
        name: "get_pet_status",
        description: "取得寵物目前的飢餓度與心情",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_alarms_and_todos",
        description: "取得所有已設定的鬧鐘排程與待辦事項清單",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "read_clipboard",
        description: "讀取使用者目前的系統剪貼簿文字內容。注意：此為高權限工具，需使用者在設定中啟用權限。",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "compute_hash",
        description: "計算指定文字的雜湊值 (Hash) 或編碼/解碼。支援 md5, sha256, sha1, base64_encode, base64_decode。當主人要求計算 MD5、SHA256、雜湊或編碼時務必優先使用本工具以保證精準性。",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "要進行計算或轉換的原始文字內容"
            },
            algorithm: {
              type: "string",
              enum: ["md5", "sha256", "sha1", "base64_encode", "base64_decode"],
              description: "演算法類型，預設為 'md5'"
            }
          },
          required: ["text"]
        }
      }
    ],
  };
});

// 處理 Tool 呼叫
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "add_todo") {
    const state = getPetState();
    const newTodo = {
      id: Date.now().toString(),
      text: args.text,
      done: false,
      reminderTime: args.reminderTime || '',
      snoozeInterval: 5
    };
    state.todos.push(newTodo);
    savePetState(state);
    return {
      content: [{ type: "text", text: `成功新增待辦事項: ${args.text}` }]
    };
  }
  
  if (name === "add_alarm") {
    const alarms = getAlarms();
    const newAlarm = {
      id: Date.now().toString(),
      time: args.time,
      message: args.message,
      snoozeInterval: 5,
      enabled: true
    };
    alarms.push(newAlarm);
    saveAlarms(alarms);
    return {
      content: [{ type: "text", text: `成功設定鬧鐘: ${args.time} - ${args.message}` }]
    };
  }
  
  if (name === "change_outfit") {
    const state = getPetState();
    if (!state.outfits) state.outfits = [];
    const targetOutfit = args.outfit || '';
    const mode = args.mode || 'replace';

    if (!targetOutfit || mode === 'clear') {
      state.outfits = [];
      state.outfit = '';
    } else if (mode === 'add') {
      if (!state.outfits.includes(targetOutfit)) {
        state.outfits.push(targetOutfit);
      }
      state.outfit = targetOutfit;
    } else if (mode === 'remove') {
      state.outfits = state.outfits.filter(o => o !== targetOutfit);
      state.outfit = state.outfits.length > 0 ? state.outfits[state.outfits.length - 1] : '';
    } else {
      // replace (預設)
      state.outfits = [targetOutfit];
      state.outfit = targetOutfit;
    }

    savePetState(state);
    return {
      content: [{ type: "text", text: `成功更換服飾為: ${state.outfits.length > 0 ? state.outfits.join(', ') : '無'}` }]
    };
  }
  
  if (name === "get_pet_status") {
    const state = getPetState();
    return {
      content: [{ type: "text", text: `飢餓度: ${state.hunger}/100, 心情: ${state.mood}/100` }]
    };
  }
  
  if (name === "get_alarms_and_todos") {
    let resultText = "";
    
    // Alarms
    const alarms = getAlarms();
    if (alarms.length === 0) {
      resultText += "目前沒有任何鬧鐘排程。\n";
    } else {
      const alarmsText = alarms.map(a => `- ${a.time}: ${a.message} (啟用狀態: ${a.enabled})`).join('\n');
      resultText += `目前的鬧鐘有：\n${alarmsText}\n`;
    }
    
    // Todos
    const state = getPetState();
    if (!state.todos || state.todos.length === 0) {
      resultText += "目前沒有任何待辦事項。";
    } else {
      const todosText = state.todos.map(t => `- ${t.text} (完成狀態: ${t.done}${t.reminderTime ? ', 提醒時間: ' + t.reminderTime : ''})`).join('\n');
      resultText += `目前的待辦事項有：\n${todosText}`;
    }
    
    return { content: [{ type: "text", text: resultText }] };
  }

  if (name === "read_clipboard") {
    const state = getPetState();
    if (!state.settings || !state.settings.enableClipboard) {
      return {
        content: [{
          type: "text",
          text: "【權限未啟用】主人目前尚未在設定中開啟「剪貼簿存取權限」。請用親切可愛的語氣提醒主人：若需要此功能，可以至右鍵選單的「設定中心」>「系統權限與隱私」中勾選啟用剪貼簿權限喔！"
        }]
      };
    }
    let text = "";
    try {
      if (process.platform === 'win32') {
        text = require('child_process').execSync('powershell.exe -NoProfile -Command "Get-Clipboard"', { encoding: 'utf8' }).trim();
      } else if (process.platform === 'darwin') {
        text = require('child_process').execSync('pbpaste', { encoding: 'utf8' }).trim();
      } else {
        text = require('child_process').execSync('xclip -selection clipboard -o', { encoding: 'utf8' }).trim();
      }
    } catch (e) {
      return { content: [{ type: "text", text: `讀取剪貼簿失敗: ${e.message}` }] };
    }
    return {
      content: [{ type: "text", text: text ? `剪貼簿內容為：\n${text}` : "剪貼簿目前是空的。" }]
    };
  }

  if (name === "compute_hash") {
    const text = String(args.text || "");
    const algo = (args.algorithm || "md5").toLowerCase();
    const { computeHash } = require("../utils/crypto_utils");
    try {
      const result = computeHash(text, algo);
      return {
        content: [
          {
            type: "text",
            text: `【${algo.toUpperCase()} 計算成功】\n計算結果: ${result}`
          }
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `計算失敗: ${err.message}` }]
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wiki Wiki MCP Server running on stdio");
}

main().catch(console.error);
