
let bubbleTimeout = null;
let isAlarmActive = false;
let pomodoroTimer = null;

let sessionContext = [];
let lastInteractionTime = 0;
let lastRealReply = '';
const MAX_HISTORY_MESSAGES = 20;


function init({
  chatBubble, chatContent, chatClose, chatClear, chatInput, chatEscHint, customMenu,
  kiwi, kiwiAccessory, namePrefix,
  petState, savePetState, loadPetState, applyOutfitPos,
  getIsWorking, setIsWorking,
  laser, ai, mcpClient, geminiTools, crypto,
  saveChatHistory, clearChatHistory, resetIdle, ipcRenderer
}) {
  
  // 點擊關閉按鈕隱藏泡泡
  chatClose.addEventListener('click', () => {
    chatBubble.style.display = 'none';
  });
  
  if (chatClear) {
    chatClear.addEventListener('click', () => {
      sessionContext = [];
      lastRealReply = '';
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
      
      // 防呆：如果沒有設定 API Key
      if (!ai) {
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
      
      // 判斷是否逾時重置上下文 (5分鐘 = 300,000 毫秒)
      const now = Date.now();
      if (now - lastInteractionTime > 5 * 60 * 1000) {
        sessionContext = [];
        lastRealReply = '';
      }
      lastInteractionTime = now;

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
【重要指示】當使用者要求設定、更改裝扮或「查詢目前/今天的鬧鐘/待辦事項」時，你必須優先呼叫系統提供的工具 (Tools)。在工具回傳結果之前，不要輸出任何回覆文字，絕不能憑空捏造工具名稱。`;
        
        sessionContext.push({ role: 'user', parts: [{ text: text }] });
        
        let response = await ai.models.generateContent({
          model: petState.settings?.aiModel || 'gemini-3.5-flash-lite',
          contents: sessionContext,
          config: { 
            systemInstruction: sysInstruction,
            tools: geminiTools.length > 0 ? geminiTools : undefined 
          }
        });
        
        if (response.functionCalls && response.functionCalls.length > 0) {
          const functionResponses = [];
          for (const call of response.functionCalls) {
             console.log("Calling tool:", call.name, call.args);
              try {
                const result = await mcpClient.callTool({ name: call.name, arguments: call.args });
                const textResult = result.content ? result.content.map(c => c.text).join('\n') : "成功";
                
                const fnResp = {
                  name: call.name,
                  response: { result: textResult }
                };
                if (call.id) fnResp.id = call.id;
                
                functionResponses.push({
                  functionResponse: fnResp
                });
               
               // 即時反映本地狀態更新
               if (call.name === 'add_todo' || call.name === 'change_outfit') {
                  loadPetState();
                   if (call.name === 'change_outfit') {
                     if (petState.outfit) applyOutfitPos();
                   }
                  ipcRenderer.send('pet-state-changed');
               }
               if (call.name === 'add_alarm') {
                  ipcRenderer.send('alarms-changed');
               }
             } catch (e) {
               console.error("Tool execution error:", e);
               functionResponses.push({
                 functionResponse: {
                   name: call.name,
                   response: { error: e.message }
                 }
               });
             }
          }
          
          sessionContext.push({ role: 'model', parts: response.candidates[0].content.parts });
          sessionContext.push({ role: 'user', parts: functionResponses });
          
          response = await ai.models.generateContent({
             model: petState.settings?.aiModel || 'gemini-3.5-flash-lite',
             contents: sessionContext,
             config: { 
               systemInstruction: sysInstruction,
               tools: geminiTools.length > 0 ? geminiTools : undefined 
             }
          });
        }
        
        sessionContext.push({ role: 'model', parts: response.candidates[0].content.parts });
        
        // 確保不超過 MAX_HISTORY_MESSAGES
        while (sessionContext.length > MAX_HISTORY_MESSAGES) {
          sessionContext.shift(); // 移除 user
          if (sessionContext.length > 0 && sessionContext[0].role === 'model') {
            sessionContext.shift(); // 同時移除對應的 model
          }
        }
  
        // 避免 AI 回答包含 HTML 標籤破壞畫面
        const safeText = (response.text || "").replace(/</g, '&lt;').replace(/>/g, '&gt;');
        lastRealReply = safeText;
        chatContent.innerHTML = `${namePrefix}${safeText}`;
        
        // 儲存奇異鳥回答
        saveChatHistory('kiwi', response.text || "");
        
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
        // 如果 API 呼叫失敗，移除剛剛加入的 user 訊息，避免下次變成連續兩個 user 訊息
        if (sessionContext.length > 0 && sessionContext[sessionContext.length - 1].role === 'user') {
          sessionContext.pop();
        }
        
        console.error(err);
        try { require('fs').writeFileSync('chat_error.log', err.stack || err.message || JSON.stringify(err)); } catch(e){}
        // 判斷是否為額度用盡的錯誤 (429 / RESOURCE_EXHAUSTED) 或 伺服器忙碌 (503)
        if (err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && (err.message.includes('429') || err.message.includes('quota')))) {
          chatContent.innerHTML = `${namePrefix}嗚嗚，主人的 API 額度好像用完了 😭 沒飯吃了，快去申請新的鑰匙餵我！`;
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
  });
  function openChat() {
    const now = Date.now();
    let hasMemory = false;
    
    // Check if memory has expired (5 mins)
    if (now - lastInteractionTime > 5 * 60 * 1000) {
      sessionContext = [];
    } else if (sessionContext.length > 0) {
      hasMemory = true;
    }
    
    // If there is memory, show the bubble with the last response
    if (hasMemory && lastRealReply) {
      chatContent.innerHTML = `${namePrefix}${lastRealReply}`;
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
  
  return { showTempBubble, showAlarmBubble, openChat };
}
module.exports = { init };
