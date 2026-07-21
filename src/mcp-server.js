require('./logger');
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
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
const petStatePath = path.join(__dirname, '../pet_state.json');
const alarmsPath = path.join(__dirname, '../alarms.json');

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
server.setRequestHandler("tools/list", async () => {
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
        description: "為寵物更換服飾或配件",
        inputSchema: {
          type: "object",
          properties: {
            outfit: { type: "string", description: "服飾的 emoji，支援 '🎩', '🕶️', '🎀', '👑'。若要脫下服飾，請傳入空字串 ''" }
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
        description: "取得所有已設定的鬧鐘、提醒與待辦事項清單",
        inputSchema: { type: "object", properties: {} }
      }
    ],
  };
});

// 處理 Tool 呼叫
server.setRequestHandler("tools/call", async (request) => {
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
    state.outfit = args.outfit || '';
    savePetState(state);
    return {
      content: [{ type: "text", text: `成功更換服飾為: ${state.outfit || '無'}` }]
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
      resultText += "目前沒有任何鬧鐘或提醒。\n";
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

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wiki Wiki MCP Server running on stdio");
}

main().catch(console.error);
