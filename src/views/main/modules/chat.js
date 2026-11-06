
const { renderMarkdown } = require('../../../utils/markdown');
const { recordUsage, getUsageSummary } = require('../../../utils/usage_tracker');

let bubbleTimeout = null;
let isAlarmActive = false;
let pomodoroTimer = null;

let sessionContext = [];
let lastInteractionTime = 0;
let lastRealReply = '';
let lastRealReplyRaw = '';
const MAX_HISTORY_MESSAGES = 20;
const MAX_AGENT_STEPS = 5;

function getToolStatusHint(toolName) {
  switch (toolName) {
    case 'add_todo':
      return '正在記下待辦事項... (•ө•)✎';
    case 'add_alarm':
      return '正在設定鬧鐘... ⏰';
    case 'change_outfit':
      return '正在挑選服飾配件... 🎀';
    case 'get_pet_status':
      return '正在確認我的狀態... (•ө•)?';
    case 'get_alarms_and_todos':
      return '正在翻閱鬧鐘與待辦清單... 📜';
    case 'read_clipboard':
      return '正在讀取剪貼簿... 📋';
    default:
      return `正在執行 ${toolName}... (•ө•)و`;
  }
}

function trimSessionContext(context, maxMessages = MAX_HISTORY_MESSAGES) {
  while (context.length > maxMessages) {
    context.shift();
  }
  // 確保開頭是合法的 user 對話，避免遺留孤立的 functionResponse 導致 API 報錯
  while (context.length > 0) {
    const first = context[0];
    const isUserTextMessage = first.role === 'user' && Array.isArray(first.parts) && first.parts.some(p => typeof p.text === 'string');
    if (isUserTextMessage) break;
    context.shift();
  }
}


function init({
  chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix,
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking, setIsWorking,
  laser, ai, getAI, mcpClient, getMcpClient, geminiTools, getGeminiTools, crypto,
  saveChatHistory, clearChatHistory, resetIdle, ipcRenderer
}) {
  const resolveAI = () => (typeof getAI === 'function' ? getAI() : ai);
  const resolveMcpClient = () => (typeof getMcpClient === 'function' ? getMcpClient() : mcpClient);
  const resolveGeminiTools = () => (typeof getGeminiTools === 'function' ? getGeminiTools() : geminiTools);
  
  // 監聽對話框狀態，更新父容器樣式以提高效能
  const container = chatBubble.parentElement;
  const updateContainerStyles = () => {
    const bVisible = chatBubble.style.display !== 'none';
    const iVisible = chatInput.style.display !== 'none';
    
    if (bVisible || iVisible) container.classList.add('show-arrow');
    else container.classList.remove('show-arrow');
    
    if (bVisible && iVisible) container.classList.add('unified-chat');
    else container.classList.remove('unified-chat');
  };
  
  const observer = new MutationObserver(updateContainerStyles);
  observer.observe(chatBubble, { attributes: true, attributeFilter: ['style'] });
  observer.observe(chatInput, { attributes: true, attributeFilter: ['style'] });
  updateContainerStyles();
  
  // 點擊關閉按鈕隱藏泡泡
  chatClose.addEventListener('click', () => {
    chatBubble.style.display = 'none';
  });

  const chatExpandBtn = document.getElementById('chat-expand-btn');
  if (chatExpandBtn) {
    chatExpandBtn.addEventListener('click', () => {
      const textToInspect = lastRealReplyRaw || chatContent.innerText || '';
      ipcRenderer.send('open-inspector', {
        title: 'Agent 回覆檢閱板',
        content: textToInspect,
        timestamp: Date.now()
      });
    });
  }

  // 代碼區塊內部一鍵複製按鈕委派
  chatContent.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.md-code-copy-btn');
    if (!copyBtn) return;
    const rawCode = decodeURIComponent(copyBtn.getAttribute('data-code') || '');
    if (rawCode) {
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(rawCode);
        const originalText = copyBtn.innerText;
        copyBtn.innerText = '✅ 已複製！';
        copyBtn.style.color = '#86efac';
        setTimeout(() => {
          copyBtn.innerText = originalText;
          copyBtn.style.color = '#cbd5e1';
        }, 1500);
      } catch (_) {}
    }
  });
  
  if (chatClear) {
    chatClear.addEventListener('click', () => {
      sessionContext = [];
      lastRealReply = '';
      lastRealReplyRaw = '';
      chatContent.innerHTML = `${namePrefix}記憶已清除，請隨時開啟新話題！`;
    });
  }
  
  // 按下 ESC 也可以隱藏各種浮動面板 (全域監聽)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (customMenu.style.display !== 'none') {
        customMenu.style.display = 'none';
      } else if (chatBubble.style.display === 'block') {
        chatBubble.style.display = 'none';
      }
    }
  });
  
  // 設定名稱前綴的 HTML
  

  function showTempBubble(text, duration = 5000) {
    if (isAlarmActive) return; // 不要覆蓋提醒氣泡
    chatBubble.style.display = 'block';
    chatContent.innerHTML = `${namePrefix}${text}`;
    
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      chatBubble.style.display = 'none';
    }, duration);
  }
  
  ipcRenderer.on('summon-kiwi', () => {
    if (laser.getIsLaserGameActive()) {
      laser.toggleLaserGame(false);
    }
    resetIdle();
  
    const heart = document.getElementById('kiwi-heart');
    if (heart) {
      heart.style.display = 'block';
      heart.style.animation = 'none';
      heart.offsetHeight;
      heart.style.animation = 'floatHeart 1s ease-out forwards';
      setTimeout(() => { heart.style.display = 'none'; }, 1000);
    }
    
    kiwi.classList.add('jumping');
    setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
  
    const summonPhrases = [
      '主人！ (・ω・)ノ',
      '我召喚出來啦！(˵¯͒〰¯͒˵)',
      '聽候您的差遣( ੭•͈ω•͈)੭',
      '我來了！(蹦跳) ٩(ˊᗜˋ*)و',
      '登愣！我出現啦！ ⸜(๑\'ᵕ\'๑)⸝'
    ];
    const phrase = summonPhrases[Math.floor(Math.random() * summonPhrases.length)];
    showTempBubble(`✨ ${phrase}`, 3000);
  });
  
  ipcRenderer.on('show-update-progress', (event, { percent, speed, text }) => {
    if (isAlarmActive) return;
    chatBubble.style.display = 'block';
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    
    if (text) {
      chatContent.innerHTML = text;
    } else {
      chatContent.innerHTML = `📥 正在下載更新... <b>${percent}%</b><br><span style="font-size:11px; color:#555;">(${speed})</span>`;
    }
  });
  


  
  function showAlarmBubble(alarm, onSnooze) {
    isAlarmActive = true;
    chatBubble.style.display = 'block';
    if (bubbleTimeout) clearTimeout(bubbleTimeout);
    
    const snoozeMins = alarm.snoozeInterval || 5;
    
    chatContent.innerHTML = `
      ${namePrefix}⏰ 提醒：<br>
      <div style="margin: 5px 0; word-break: break-all;">${alarm.message}</div>
      <div style="display: flex; gap: 5px; margin-top: 8px;">
        <button id="btn-alarm-ok" style="flex:1; padding: 4px; border: none; background: #4caf50; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; white-space: nowrap;">我知道了</button>
        <button id="btn-alarm-snooze" style="flex:1; padding: 4px; border: none; background: #ff9800; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; white-space: nowrap;">稍後提醒 ${snoozeMins}分</button>
      </div>
    `;
    
    document.getElementById('btn-alarm-ok').onclick = () => {
      isAlarmActive = false;
      chatBubble.style.display = 'none';
    };
    
    document.getElementById('btn-alarm-snooze').onclick = () => {
      isAlarmActive = false;
      chatBubble.style.display = 'none';
      if (onSnooze) onSnooze(alarm, snoozeMins);
    };
  }
  
  
  
  
  
  // 全域監聽 ESC 鍵關閉對話
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (chatInput.style.display !== 'none' || chatBubble.style.display !== 'none') {
        chatInput.style.display = 'none';
        if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
        chatBubble.style.display = 'none';
        chatInput.value = '';
      }
    }
  });
  
  // 監聽輸入框的 Enter 鍵事件，呼叫 Gemini
  chatInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') {
      const text = chatInput.value;
      if (text.startsWith('/')) {
        e.preventDefault(); // 防止失去焦點
        const commands = ['/help', '/laser', '/md5', '/base64', '/uuid', '/calc', '/pomodoro', '/todo', '/clear'];
        const match = commands.find(c => c.startsWith(text));
        if (match) {
          chatInput.value = match + ' ';
        }
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 防止 textarea 換行
      const text = chatInput.value.trim();
      if (!text) return;
      await sendMessage(text);
    }
  });

  async function sendMessage(text) {
    if (!text) return;

    const currentAI = resolveAI();
    // 防呆：如果沒有設定 API Key
    if (!currentAI) {
      chatInput.value = '';
      chatInput.style.display = 'none';
      if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
      chatBubble.innerHTML = `${namePrefix}請先至「設定面板」輸入 Gemini API Key！`;
      chatBubble.style.display = 'block';
      setTimeout(() => { chatBubble.style.display = 'none'; }, 3000);
      return;
    }
    
    // 停用並隱藏輸入框，顯示思考中
    chatInput.style.display = 'none';
    if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'none';
    chatInput.disabled = true;
    chatInput.value = '';
    chatBubble.style.display = 'block';
    chatContent.innerHTML = `${namePrefix}思考中... <span style="white-space: nowrap;">( •ө•)?</span>`;
    
    // 儲存使用者對話
    saveChatHistory('user', text);
      
      // 指令模式判斷
      if (text.startsWith('/')) {
        const parts = text.split(' ');
        const cmd = parts[0];
        let argStr = parts.slice(1).join(' ').trim();
        
        let reply = '';
        if (cmd === '/help') {
          reply = 'Wiki Wiki 指令模式喵！<br>' +
                  '<b>/help</b> : 顯示這個說明<br>' +
                  '<b>/laser</b> : 開啟/關閉雷射筆追逐遊戲 🔴<br>' +
                  '<b>/md5 [字串]</b> : 轉成 md5 32碼<br>' +
                  '<b>/base64 [encode/decode] [字串]</b> : base64 轉換<br>' +
                  '<b>/uuid</b> : 產生隨機 UUID<br>' +
                  '<b>/calc [算式]</b> : 幫你算數學 (例如 1+1)<br>' +
                  '<b>/pomodoro [分鐘]</b> : 啟動番茄鐘 (預設25分)<br>' +
                  '<b>/todo [事項]</b> : 新增待辦事項<br>' +
                  '<b>/clear</b> : 清除歷史對話紀錄';
        } else if (cmd === '/laser') {
          try { laser.toggleLaserGame(); } catch (e) { require('fs').writeFileSync('error.log', e.stack); }
          chatInput.disabled = false;
          return;
        } else if (cmd === '/md5') {
          // 如果前後有雙引號，則去除
          if (argStr.startsWith('"') && argStr.endsWith('"')) {
            argStr = argStr.substring(1, argStr.length - 1);
          }
          if (!argStr) {
            reply = '喵？沒有給我要轉換的字串喔！請用 /md5 "字串"';
          } else {
            const hash = crypto.createHash('md5').update(argStr).digest('hex');
            reply = `嗶嗶！Wiki Wiki 用力一啄！(•ө•)♡<br><code>${hash}</code>`;
          }
        } else if (cmd === '/base64') {
          const subCmd = argStr.split(' ')[0];
          const textToConvert = argStr.substring(subCmd.length).trim();
          if (subCmd === 'encode') {
            reply = `Base64 編碼：<br><code>${Buffer.from(textToConvert).toString('base64')}</code>`;
          } else if (subCmd === 'decode') {
            reply = `Base64 解碼：<br><code>${Buffer.from(textToConvert, 'base64').toString('utf8')}</code>`;
          } else {
            reply = '喵？請輸入 `/base64 encode 字串` 或 `/base64 decode 字串`';
          }
        } else if (cmd === '/uuid') {
          reply = `送你一個熱騰騰的 UUID：<br><code>${crypto.randomUUID()}</code>`;
        } else if (cmd === '/quota' || cmd === '/usage' || text.trim() === '額度' || text.trim() === '剩餘額度') {
          const quotaSummary = getUsageSummary(petState.settings?.aiModel);
          const r = quotaSummary.resetInfo;
          reply = `📊 今日 AI 用量回報：<br>• 今日已用：<b>${quotaSummary.todayRequests} / ${quotaSummary.limitRPD} 次</b> (剩餘約 ${quotaSummary.remainingRequests} 次)<br>• 消耗 Token：<b>${Number(quotaSummary.todayTokens).toLocaleString()}</b><br>• 每日重設時間：<b>今日 ${r.resetTimeStr}</b> (倒數 ${r.remainingHours} 小時 ${r.remainingMinutes} 分)<br>• 當前頻率：<b>${quotaSummary.minuteRequests} / ${quotaSummary.limitRPM} RPM</b>`;
        } else if (cmd === '/calc') {
          try {
            // 簡易安全替換，避免注入
            const safeMath = argStr.replace(/[^0-9+\-*/().]/g, '');
            const result = new Function(`return ${safeMath}`)();
            reply = `Wiki Wiki 算出來了！<br><code>${argStr} = ${result}</code>`;
          } catch (e) {
            reply = '數學太難了，Wiki Wiki 腦袋打結惹 😵‍💫';
          }
        } else if (cmd === '/pomodoro') {
          let mins = parseInt(argStr) || 25;
          reply = `番茄鐘啟動！Wiki Wiki 會陪你專注 ${mins} 分鐘！加油！(๑•̀ㅂ•́)و✧`;
          
        setIsWorking(true);
          kiwiAccessory.innerText = '⏳';
          kiwiAccessory.style.display = 'block';
          clearTimeout(pomodoroTimer);
          
          pomodoroTimer = setTimeout(() => {
          setIsWorking(false);
            kiwiAccessory.style.display = 'none';
            chatBubble.style.display = 'block';
            chatContent.innerHTML = `${namePrefix}嗶嗶嗶！${mins} 分鐘到啦！快起來喝口水、伸展一下筋骨吧！🐦💦`;
          }, mins * 60 * 1000);
        } else if (cmd === '/todo') {
          if (!argStr) {
            reply = '喵？請告訴我要記下什麼待辦事項喔！例如 `/todo 買牛奶`';
          } else {
            petState.todos.push({ id: crypto.randomUUID(), text: argStr, done: false, reminderTime: null, snoozeInterval: 5 });
            savePetState();
            reply = `記下來啦！✍️<br>「${argStr}」<br>已經加到待辦清單囉！(你可以右鍵打開「待辦事項」管理喔)`;
          }
        } else if (cmd === '/clear') {
          clearChatHistory();
          reply = '咻！💨 已經幫你把歷史紀錄清得乾乾淨淨啦！';
        } else {
          reply = '這是什麼奇怪的指令呀？Wiki Wiki 聽不懂 (歪頭)<br>試試看 /help 吧！';
        }
        
        lastRealReply = reply;
        chatContent.innerHTML = `${namePrefix}${reply}`;
        saveChatHistory('kiwi', reply);
        
        chatInput.style.display = 'block';
        if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
        chatInput.disabled = false;
        chatInput.placeholder = '對話... (Shift+Enter 換行)';
        chatInput.focus();
        
        kiwi.classList.add('jumping');
        setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
        return;
      }
      
      // 判斷是否逾時重置上下文
      const now = Date.now();
      const timeoutMins = petState.settings.contextTimeout !== undefined ? petState.settings.contextTimeout : 5;
      if (timeoutMins > 0 && now - lastInteractionTime > timeoutMins * 60 * 1000) {
        sessionContext = [];
        lastRealReply = '';
      }
      lastInteractionTime = now;
      const contextLengthBeforeTurn = sessionContext.length;

      try {
        const p = petState.settings.aiPersonality || 'default';
        const customP = petState.settings.aiCustomPrompt || '';
        let personaText = "請用簡短、活潑、賣萌的語氣說話（回答控制在 50 字以內，可以加上顏文字）。";
        if (p === 'bard') {
          personaText = "請扮演西式奇幻風格的「吟遊詩人」，說話方式必須充滿「押韻」與「詩意」，像是唱歌或吟誦詩歌一般。充滿節奏感，但不准使用中國古詩詞。請盡量在 50 字以內，一定要押韻並帶有音樂般的節奏感。";
        } else if (p === 'grumpy') {
          personaText = "請扮演一隻傲嬌、覺得人類很麻煩但又不得不幫忙的奇異鳥。稍微慵懶、怕麻煩，但其實還是會幫對方，不能有攻擊性或壞脾氣，帶點可愛的懶散性格（回答控制在 50 字以內）。";
        } else if (p === 'custom' && customP) {
          personaText = `請遵循以下特殊個性設定來回覆：\n${customP}\n（請盡量在 50 字以內）`;
        }
  
        const sysInstruction = `你現在是一隻生活在電腦桌面上的奇異鳥助理，名字叫 Wiki Wiki。
${personaText}
【Agent 行動準則】
1. 你是一個具備自主規劃與執行能力的桌面寵物 Agent。面對主人的複雜需求（例如同時要記待辦、設定鬧鐘、更換飾品、讀取剪貼簿或查詢狀態），你可以自主規劃並分步驟呼叫工具來完成任務。
2. 當需要操作或查詢系統資料時，必須優先呼叫系統提供的工具 (Tools)。
3. 當主人詢問剪貼簿內容、要求讀取剪貼簿或依剪貼簿內容處理任務時，請優先呼叫 read_clipboard 工具。若工具回報權限未啟用，請以親切可愛的語氣提醒主人可至右鍵「設定中心」開啟「允許讀取系統剪貼簿」權限。
4. 呼叫 change_outfit 工具時，請依使用者語意指定正確的 mode：
   - 使用者說「戴上/穿上/加個XX」時，mode 請用 "add"（疊加保留現有飾品）。
   - 使用者說「換成/只戴/改成XX」時，mode 請用 "replace"（換掉其他飾品）。
   - 使用者說「脫下/摘掉/拿下XX」時，mode 請用 "remove"。
   - 使用者說「全部脫掉/脫光」時，mode 請用 "clear"。
5. 完成所有步驟後，請用符合你個性的可愛語氣，向主人清晰且親切地彙整你的執行結果。`;
        
        sessionContext.push({ role: 'user', parts: [{ text: text }] });
        
        const activeAI = resolveAI();
        const activeTools = resolveGeminiTools();
        const activeMcpClient = resolveMcpClient();

        let stepCount = 0;
        let finalResponseText = '';

        while (stepCount < MAX_AGENT_STEPS) {
          let response = await activeAI.generateContent({
            model: petState.settings?.aiModel || 'gemini-3.5-flash-lite',
            contents: sessionContext,
            config: { 
              systemInstruction: sysInstruction,
              tools: (activeTools && activeTools.length > 0) ? activeTools : undefined 
            }
          });

          if (response && response.usageMetadata) {
            recordUsage({
              promptTokens: response.usageMetadata.promptTokenCount || 0,
              candidateTokens: response.usageMetadata.candidatesTokenCount || 0,
              totalTokens: response.usageMetadata.totalTokenCount || 0
            });
          } else {
            recordUsage();
          }

          const candidate = response.candidates && response.candidates[0];
          const functionCalls = response.functionCalls || [];

          if (functionCalls.length === 0) {
            // 沒有工具需要呼叫，代表已得到最終思考與回覆
            if (candidate && candidate.content && candidate.content.parts) {
              sessionContext.push({ role: 'model', parts: candidate.content.parts });
            }
            finalResponseText = response.text || "";
            break;
          }

          // 記錄模型輸出的 function calls
          if (candidate && candidate.content && candidate.content.parts) {
            sessionContext.push({ role: 'model', parts: candidate.content.parts });
          }

          stepCount++;
          const functionResponses = [];

          for (const call of functionCalls) {
            console.log(`[Agent Step ${stepCount}] Calling tool:`, call.name, call.args);
            const statusHint = getToolStatusHint(call.name);
            chatContent.innerHTML = `${namePrefix}${statusHint}`;

            if (call.name === 'read_clipboard') {
              const isEnabled = Boolean(petState.settings && petState.settings.enableClipboard);
              let textResult = "";
              if (!isEnabled) {
                textResult = "【權限未啟用】主人目前尚未在設定中心開啟「剪貼簿存取權限」。請用親切可愛的語氣提醒主人：若需要此功能，可以至右鍵選單的「設定中心」>「系統權限與隱私」中勾選啟用剪貼簿權限喔！";
              } else {
                try {
                  const { clipboard } = require('electron');
                  const clip = clipboard.readText();
                  textResult = clip && clip.trim() ? `剪貼簿目前的文字內容如下：\n${clip}` : "剪貼簿目前是空的（沒有文字內容）。";
                } catch (e) {
                  textResult = `讀取剪貼簿失敗: ${e.message}`;
                }
              }
              const fnResp = {
                name: call.name,
                response: { result: textResult }
              };
              if (call.id) fnResp.id = call.id;
              functionResponses.push({ functionResponse: fnResp });
              continue;
            }

            try {
              if (!activeMcpClient) {
                throw new Error("MCP Client 尚未連線或未初始化完成");
              }
              const result = await activeMcpClient.callTool({ name: call.name, arguments: call.args });
              const textResult = result.content ? result.content.map(c => c.text).join('\n') : "成功";
              
              const fnResp = {
                name: call.name,
                response: { result: textResult }
              };
              if (call.id) fnResp.id = call.id;

              functionResponses.push({ functionResponse: fnResp });

              // 即時反映本地狀態更新
              if (call.name === 'add_todo' || call.name === 'change_outfit') {
                loadPetState();
                if (call.name === 'change_outfit') {
                  if (typeof applyOutfitPos === 'function') {
                    applyOutfitPos();
                  }
                  ipcRenderer.send('update-outfit', petState.outfits || []);
                }
                ipcRenderer.send('pet-state-changed');
              }
              if (call.name === 'add_alarm') {
                ipcRenderer.send('alarms-changed');
              }
            } catch (e) {
              console.error(`[Agent Step ${stepCount}] Tool execution error:`, e);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: e.message }
                }
              });
            }
          }

          sessionContext.push({ role: 'user', parts: functionResponses });

          // 如果達到最大步數，進行強制總結
          if (stepCount >= MAX_AGENT_STEPS) {
            console.warn(`[Agent] Reached MAX_AGENT_STEPS (${MAX_AGENT_STEPS}), summarizing...`);
            chatContent.innerHTML = `${namePrefix}正在彙整最後結果... (•ө•)੭`;
            const summaryResponse = await activeAI.generateContent({
              model: petState.settings?.aiModel || 'gemini-3.5-flash-lite',
              contents: sessionContext,
              config: { 
                systemInstruction: sysInstruction + "\n【重要指令】已完成所有可用步驟，請根據先前的執行結果做最後的完整結論與回覆，不要再調用任何工具。"
              }
            });
            if (summaryResponse.candidates && summaryResponse.candidates[0]?.content?.parts) {
              sessionContext.push({ role: 'model', parts: summaryResponse.candidates[0].content.parts });
            }
            if (summaryResponse.usageMetadata) {
              recordUsage({
                promptTokens: summaryResponse.usageMetadata.promptTokenCount || 0,
                candidateTokens: summaryResponse.usageMetadata.candidatesTokenCount || 0,
                totalTokens: summaryResponse.usageMetadata.totalTokenCount || 0
              });
            } else {
              recordUsage();
            }
            finalResponseText = summaryResponse.text || "";
            break;
          }
        }

        // 確保不超過 MAX_HISTORY_MESSAGES 並維持 context 合法性
        trimSessionContext(sessionContext, MAX_HISTORY_MESSAGES);
  
        // 格式化 Markdown 排版（支援加粗、代碼塊、清單、段落分行）
        lastRealReplyRaw = finalResponseText || "";
        const formattedHtml = renderMarkdown(lastRealReplyRaw);
        lastRealReply = formattedHtml;
        chatContent.innerHTML = formattedHtml;
        
        // 儲存奇異鳥回答
        saveChatHistory('kiwi', finalResponseText || "");
        
        // 重新啟用輸入框
        chatInput.style.display = 'block';
        if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
        chatInput.disabled = false;
        chatInput.placeholder = '對話... (Shift+Enter 換行)';
        chatInput.focus();
        
        // 收到回答後開心地跳躍
        kiwi.classList.add('jumping');
        setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      } catch (err) {
        // 如果 API 呼叫失敗，安全回滾未完成的對話狀態，避免留存不完整的 user / function 訊息
        while (sessionContext.length > contextLengthBeforeTurn) {
          sessionContext.pop();
        }
        
        console.error(err);
        try { require('fs').writeFileSync('chat_error.log', err.stack || err.message || JSON.stringify(err)); } catch(e){}
        // 判斷是否為額度用盡的錯誤 (429 / RESOURCE_EXHAUSTED) 或 伺服器忙碌 (503)
        if (err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && (err.message.includes('429') || err.message.includes('quota')))) {
          const quotaSummary = getUsageSummary(petState.settings?.aiModel);
          const r = quotaSummary.resetInfo;
          if (quotaSummary.isRateLimitClose || (err.message && err.message.includes('minute'))) {
            chatContent.innerHTML = `${namePrefix}咕啾！主人您問得太快啦 (•ө•) 每分鐘有 15 次頻率限制，請稍候 30 秒再跟我聊喔！`;
          } else {
            chatContent.innerHTML = `${namePrefix}嗚嗚，今天的免費額度好像用完了 😭 預計將於今日 ${r.resetTimeStr}（倒數約 ${r.remainingHours} 小時 ${r.remainingMinutes} 分）自動重設！也可以至設定中心更換 API Key 喔！`;
          }
        } else if (err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && err.message.includes('503'))) {
          chatContent.innerHTML = `${namePrefix}Google 伺服器現在大塞車，請等一下再跟我說話喔！ 😵‍💫`;
        } else {
          chatContent.innerHTML = `${namePrefix}咕啾？我的小腦袋打結了，網路連線好像怪怪的 😵‍💫`;
        }
        chatInput.style.display = 'block';
        if(typeof chatEscHint !== 'undefined') chatEscHint.style.display = 'block';
        chatInput.disabled = false;
        chatInput.placeholder = '對話... (Shift+Enter 換行)';
        chatInput.focus();
      }
    }

  function openChat() {
    const now = Date.now();
    let hasMemory = false;
    
    // Check if memory has expired
    const timeoutMins = petState.settings.contextTimeout !== undefined ? petState.settings.contextTimeout : 5;
    if (timeoutMins > 0 && now - lastInteractionTime > timeoutMins * 60 * 1000) {
      sessionContext = [];
    } else if (sessionContext.length > 0) {
      hasMemory = true;
    }
    
    // If there is memory, show the bubble with the last response
    if (hasMemory && lastRealReply) {
      chatContent.innerHTML = lastRealReply;
      chatBubble.style.display = 'block';
    } else {
      chatBubble.style.display = 'none';
    }
    
    chatInput.style.display = 'block';
    if (typeof chatEscHint !== 'undefined' && chatEscHint) {
      chatEscHint.style.display = 'block';
    }
    chatInput.disabled = false;
    chatInput.placeholder = '對話... (Shift+Enter 換行)';
    chatInput.focus();
  }
  
  return { showTempBubble, showAlarmBubble, openChat, sendMessage };
}
module.exports = { init };
