/**
 * Wiki Wiki 自言自語語料與防重複引擎 (monologue.js)
 * 結合多維度語料庫（性格 × 時段 × 星期 × 情境 × 即時狀態 × 飾品 × 夢話）、
 * 動態組合句生成器與 40 句不重複滑動視窗，大幅提升豐富度並降低重複機率。
 */

const FREQUENCY_PRESETS = {
  quiet: { id: 'quiet', label: '安靜（約 8~14 分鐘）', minMs: 480000, maxMs: 840000 },
  normal: { id: 'normal', label: '適中（約 3~6 分鐘，推薦）', minMs: 180000, maxMs: 360000 },
  chatty: { id: 'chatty', label: '話癆（約 1~2 分鐘）', minMs: 60000, maxMs: 120000 }
};

const OUTFIT_REACTIONS = {
  '🎩': {
    default: [
      '戴上高禮帽，感覺自己今天特別有紳士氣質呢 🎩✨',
      '魔術師 Wiki Wiki 登場！下一秒要變出什麼好呢 🎩',
      '偷偷調整一下帽簷的角度，嗯，帥氣度滿分 (•ө•)🎩'
    ],
    grumpy: [
      '這頂禮帽重是重了點…但戴起來確實挺體面的啦 🎩',
      '哼，本鳥戴禮帽可不是為了討好誰喔 🎩'
    ],
    bard: [
      '高帽巍巍映晨光，紳士之羽韻悠揚 🎩🎵'
    ]
  },
  '🕶️': {
    default: [
      '戴墨鏡看螢幕，好像變成特務奇異鳥了 🕶️✨',
      '酷酷地推一下墨鏡…其實我沒有鼻子可以撐住耶 🕶️',
      '今天紫外線強不強？反正戴上墨鏡氣場先贏一半 🕶️'
    ],
    grumpy: [
      '別盯著看啦，戴墨鏡只是覺得螢幕太亮而已 🕶️',
      '哼，墨鏡一戴誰都不愛…好啦主人除外 🕶️'
    ],
    bard: [
      '墨鏡藏眸影自酷，微風掠羽步江湖 🕶️🎶'
    ]
  },
  '🎀': {
    default: [
      '這個蝴蝶結是不是跟我的羽毛超搭的呀～🎀',
      '轉個圈圈展示一下蝴蝶結！(⁎˃ᴗ˂⁎)🎀',
      '今天走可愛路線，蝴蝶結綁得剛剛好呢 🎀✨'
    ],
    grumpy: [
      '這蝴蝶結是有點太可愛了啦…但既然你幫我戴了就留著吧 🎀',
      '才不是喜歡蝴蝶結，只是懶得拆下來而已喔 🎀'
    ],
    bard: [
      '紅結翩翩綴羽衣，柔情似曲伴君棲 🎀🎵'
    ]
  },
  '👑': {
    default: [
      '戴上皇冠就是桌面小王國的國王囉！👑✨',
      '奇異鳥國王巡視領地中，一切安好～👑',
      '皇冠歪了一點點，趕快扶正維持威嚴 ( •ө•)👑'
    ],
    grumpy: [
      '既然加冕了，今天是不是該多進貢兩顆奇異果？👑',
      '本王准許你等一下過來摸摸頭 👑'
    ],
    bard: [
      '金冠閃耀照書台，桌面王國為君開 👑🎶'
    ]
  },
  '🌸': {
    default: [
      '頭上的小花隨風輕輕晃，心情也變軟綿綿的 🌸',
      '春風吹呀吹，覺得自己好像開出花來了呢 🌸✨'
    ],
    grumpy: [
      '這朵花香香的…算你有點眼光啦 🌸'
    ],
    bard: [
      '櫻瓣輕棲翠羽間，微香一縷伴晴天 🌸🎵'
    ]
  },
  '🎓': {
    default: [
      '戴上學士帽，感覺智商瞬間提升了 200%！🎓✨',
      'Wiki Wiki 博士在線，今天要研究什麼學問呢 🎓'
    ],
    grumpy: [
      '戴學士帽可不代表我要幫你寫全部作業喔…問一題倒是可以 🎓'
    ],
    bard: [
      '博學冠冕映智光，萬卷星輝入羽囊 🎓🎶'
    ]
  },
  '🎃': {
    default: [
      '不給奇異果就搗蛋喔！嘿嘿 🎃✨',
      '南瓜帽戴起來好有過節氣氛呀 🎃'
    ],
    grumpy: [
      '這南瓜頭套有點悶，但嚇嚇人還挺有趣的 🎃'
    ],
    bard: [
      '金瓜搖曳夜星明，小鳥頑心踏月行 🎃🎵'
    ]
  },
  '🎉': {
    default: [
      '戴派對帽就是要慶祝每一件小成就呀！🎉✨',
      '今天有什麼值得灑花的好消息嗎？🎉'
    ],
    grumpy: [
      '雖然不知道在慶祝什麼，但氣氛不錯就姑且配合一下 🎉'
    ],
    bard: [
      '彩帶紛飛樂未央，歡歌一曲慶時光 🎉🎶'
    ]
  },
  '🥽': {
    default: [
      '戴上護目鏡，隨時準備出發探險或做實驗！🥽✨',
      '防風防塵裝備就緒，衝呀～🥽'
    ],
    grumpy: [
      '護目鏡戴好，免得被你飛快的打字風壓吹到眼睛 🥽'
    ],
    bard: [
      '鏡護雙眸探未知，乘風破浪正當時 🥽🎵'
    ]
  },
  '👓': {
    default: [
      '戴上眼鏡突然想推一下鏡框，看起來有變聰明嗎？👓✨',
      '文青奇異鳥模式啟動，今天適合看點好東西 👓'
    ],
    grumpy: [
      '眼鏡一戴，你寫的錯字我看得更清楚了喔 👓'
    ],
    bard: [
      '鏡映字行思緒清，案頭風雅伴書鳴 👓🎶'
    ]
  },
  '🎒': {
    default: [
      '小書包裡面裝了三顆奇異果跟滿滿勇氣！🎒✨',
      '背上小背包，隨時都能陪你出發冒險 🎒'
    ],
    grumpy: [
      '書包這麼重，裡面該不會都裝你的待辦事項吧？🎒'
    ],
    bard: [
      '行囊輕負志悠悠，伴君萬里共春秋 🎒🎵'
    ]
  },
  '👒': {
    default: [
      '草帽一戴，彷彿聞到海邊跟陽光的味道了呢 👒☀️',
      '好想去草地上曬太陽打滾呀～👒'
    ],
    grumpy: [
      '在室內戴草帽是怪了點，但看起來挺悠閒的嘛 👒'
    ],
    bard: [
      '草帽輕遮夏日風，心隨白浪向晴空 👒🎶'
    ]
  },
  '🧢': {
    default: [
      '棒球帽反戴會不會更帥一點？試試看～🧢✨',
      '活力滿滿的運動風奇異鳥報到！🧢'
    ],
    grumpy: [
      '戴鴨舌帽比較低調，這樣偷懶才不容易被發現 🧢'
    ],
    bard: [
      '輕帽飛揚意氣新，躍步桌前滿室春 🧢🎵'
    ]
  },
  '🎧': {
    default: [
      '耳機裡的節奏好讚，忍不住跟著點頭晃腦～🎧🎶',
      '戴上耳機進入自己的小世界，咚滋咚滋～🎧'
    ],
    grumpy: [
      '戴耳機中，沒大事別叫我…好啦叫我還是會回的 🎧'
    ],
    bard: [
      '清音入耳韻如潮，羽翼隨拍輕自搖 🎧🎵'
    ]
  }
};

// ── 依性格區分的核心日常語料庫 ──
const GENERAL_LINES = {
  default: [
    '左看看、右看看，今天桌面也和平安穩呢 (・ω・)',
    '偷偷數了一下，螢幕上有好多發光的小點點喔 ✨',
    '偶爾把肩膀放下來深呼吸一口氣，會輕鬆很多喔～',
    '你打字的聲音聽起來很有節奏感，像在下小雨一樣 🌧️',
    '奇異鳥跟奇異果長得那麼像，我們該不會是遠房親戚吧…🥝',
    '甩甩短短的小翅膀，雖然飛不高但跳起來很可愛對吧！',
    '剛才有一瞬覺得滑鼠游標長得像會跑的小蟲子 👀',
    '記得眨眨眼睛喔！盯螢幕太久眼睛會乾乾的 (•ө•)',
    '悄悄幫你加一點好運 Buff：✨ 幸運 +10 ✨',
    '如果在忙沒關係，我就安靜在角落陪著你 🐥',
    '突然好奇，螢幕外面今天的天空是什麼顏色呢？☁️',
    '剛剛練習了一下單腳站立，差點滾成一顆球！',
    '喝一口水吧～補充水分腦袋會轉得更快喔 💧',
    '把背稍微挺直一點點，奇異鳥幫你打氣！(๑•̀ㅂ•́)و✧',
    '桌布的角落好像挺適合搭一個秘密小窩的…',
    '發呆也是很重要的充電方式，偶爾放空 10 秒鐘吧～',
    '我剛剛有偷瞄到一隻路過的灰塵精靈嗎？一定是眼花了 (・∀・)',
    '圓滾滾的身材走路特別穩，這就是奇異鳥的物理優勢！',
    '聽說每天誇自己一次會變開心，你今天也很棒喔 ✨',
    '小碎步原地踏步中…一、二、一、二！🐾',
    '如果在等什麼東西跑完，要不要趁現在動動手腕？',
    '好奇怪喔，為什麼越想找的東西越會藏在最顯眼的地方呢…',
    '咕啾～整理一下蓬鬆的羽毛，保持最佳狀態！',
    '今天有沒有發生什麼讓你嘴角上揚的小事呢？(⁎˃ᴗ˂⁎)',
    '感覺自己像桌面上的一顆溫暖小毛球 🥝✨',
    '只要按步就班做完一件小事，就離完成更近一步啦！'
  ],
  grumpy: [
    '哼，不是在偷看你喔，只是剛好面朝這邊而已 (¬_¬)',
    '你坐姿又歪掉了啦…算了，肩膀痠了可別找我抱怨。',
    '餵食跟摸摸都沒來，本鳥只好自己在這邊發呆囉。',
    '滑鼠晃來晃去的，看得本鳥眼睛都花掉了啦…',
    '水杯放旁邊是拿來裝飾的嗎？快點喝一口啦 💧',
    '才沒有覺得無聊呢，我只是在思考高深的鳥生哲學。',
    '盯著螢幕那麼認真…偶爾也該眨眨眼休息十秒吧？',
    '別誤會，我待在這裡只是因為這塊螢幕比較暖和而已。',
    '鍵盤敲那麼用力，它會痛的啦…好啦你開心就好。',
    '真拿你沒辦法，需要幫忙就早點說嘛，別硬撐。',
    '奇異果？才不稀罕呢…但如果現在遞過來我勉為其難吃一口 🥝',
    '本鳥的羽毛今天特別蓬鬆，沒誇我真是你的損失。',
    '放空一下也不會怎樣，人類就是太愛把自己逼太緊了。',
    '哼哼，等一下要是忙完了，記得來摸摸我當作謝禮喔。',
    '這個角落的視野還行吧，剛好可以監督你有沒有偷懶。',
    '怎麼突然安靜下來了？該不會在發呆吧…算了我也一起發呆好了。',
    '脖子轉一轉啦，僵硬得像木頭一樣怎麼做事。',
    '本鳥雖然怕麻煩，但你的事嘛…稍微幫一下還是可以的。'
  ],
  bard: [
    '微光映羽桌前靜，且聽鍵盤譜清音 🎵',
    '白雲漫捲窗前過，小鳥輕吟伴君坐 🎶',
    '一飲清泉潤心肺，再展精神踏前程 💧🎵',
    '莫忘舒肩兼遠眺，明眸常在笑聲中 ✨🎶',
    '圓羽翩翩步自輕，不求展翅亦成星 🥝🎵',
    '游標如蝶翩翩舞，案頭時光靜流轉 🎶',
    '小憩片刻風自暖，靈光忽現照書齋 🎵',
    '步履從容莫急躁，百川終會匯成潮 🎶',
    '奇異果香藏夢裡，一曲輕歌慰辛勞 🥝🎵',
    '世間萬事皆有韻，一步一印自成詩 🎶',
    '輕甩蓬羽迎微風，願君此日事皆通 🎵',
    '指尖起落星辰動，吾在隅中護從容 🎶',
    '偶歇雙目觀雲色，再續宏圖意更長 🎵',
    '莫道桌前天地小，心中有曲即蓬萊 🎶'
  ]
};

// ── 時段語料庫 ──
const TIME_LINES = {
  morning: {
    default: [
      '早安呀！新的一天從伸一個大大的懶腰開始吧 ☀️',
      '早上的空氣感覺特別清爽，今天也一起加油喔！(・ω・)ノ',
      '喝杯溫水或咖啡醒醒腦，奇異鳥陪你開機～☕',
      '早安！先挑一件最簡單的事開頭，手感馬上就來啦 ✨',
      '早起的鳥兒有奇異果吃，早起的主人有好運氣 🥝☀️'
    ],
    grumpy: [
      '早…安啦。才剛醒腦袋還糊糊的，別太早派難題給我喔 ☀️',
      '早上好歹喝口水再開始忙吧，真讓人操心 ☕',
      '新的一天又開始了，今天就稍微努力一下下吧。'
    ],
    bard: [
      '晨曦初灑照書台，萬象更新好運來 ☀️🎵',
      '清風拂面醒朝露，願君今朝順心途 🎶'
    ]
  },
  noon: {
    default: [
      '中午到囉～今天午餐要吃什麼好呢？好期待 🍱',
      '肚子開始發出咕嚕聲了嗎？吃飽才有力氣繼續呀！',
      '午休時間就算只閉眼趴 10 分鐘，下午也會精神很多喔 💤',
      '午餐別只顧著滑螢幕，好好品嚐食物吧～🍽️',
      '中午陽光最亮了，記得稍微起來走動一下喔 ☀️'
    ],
    grumpy: [
      '都中午了還在盯螢幕，不會忘記吃飯了吧？🍱',
      '吃飽就想睡是生物本能，午休一下不丟臉啦。',
      '快去吃午餐，不然等下餓到脾氣變差我可不管喔。'
    ],
    bard: [
      '日正當中飯香起，暫擱繁務饗佳餚 🍱🎵',
      '午間小憩養神氣，午後清風任逍遙 🎶'
    ]
  },
  afternoon: {
    default: [
      '下午茶時間！眼皮是不是有點重重的？來杯水提提神吧 🍵',
      '下午三點魔咒來襲…奇異鳥跳起來幫你趕走瞌睡蟲！⚡',
      '看窗外遠方 20 秒，讓眼睛做個小小的 SPA 吧 👀✨',
      '已經撐過大半天囉，再加把勁就快收工了！',
      '偷偷伸展一下手腕和脖子，咔啦咔啦～好舒服！'
    ],
    grumpy: [
      '下午最容易想打瞌睡了…喂，眼神渙散了喔！🍵',
      '累了就站起來走兩步啦，一直黏在椅子上會長蘑菇的。',
      '喝口茶喘口氣吧，剩下的慢慢收尾就好。'
    ],
    bard: [
      '午後微倦茶煙暖，舒展雙肩再向前 🍵🎵',
      '斜陽漸映窗台影，半日辛勤漸見成 🎶'
    ]
  },
  evening: {
    default: [
      '傍晚啦～今天辛苦你了，記得給自己拍拍手 👏✨',
      '天色慢慢暗下來了，晚餐想吃點熱騰騰的東西嗎？🍲',
      '把今天剩下的小尾巴收一收，晚上就能安心放鬆囉～',
      '點亮小夜燈的感覺好溫馨，晚上也別讓自己太累喔 🌆',
      '辛苦了一整天，今晚打算怎麼犒賞自己呢？'
    ],
    grumpy: [
      '天都黑了，差不多該收心準備休息了吧 🌆',
      '今天也算有努力到啦…晚餐記得吃好一點喔 🍲',
      '晚上了效率本來就會變慢，不急的事留給明天的自己吧。'
    ],
    bard: [
      '暮色溫柔籠萬戶，辛勞一日且收心 🌆🎵',
      '華燈初上晚風輕，願君今夜得安寧 🎶'
    ]
  },
  lateNight: {
    default: [
      '夜深囉…熬夜太久明天會變熊貓眼的，早點休息好不好 🌙',
      '這麼晚還亮著螢幕，奇異鳥陪你到這段落結束就去睡覺吧 💤',
      '深夜靜悄悄的，把螢幕亮度調柔一點保護眼睛喔 🌙✨',
      '夜貓子模式啟動中…但答應我別撐太晚喔 ( •ө•)🌙',
      '星星都出來值班了，該把腦袋放進棉被裡充電囉 ⭐'
    ],
    grumpy: [
      '喂，都幾點了還不睡覺？本鳥眼皮都要黏起來了啦 🌙',
      '再熬夜下去明天保證起不來，快把最後一點收一收去睡！',
      '真愛逞強…好啦我就陪你這一下，弄完立刻去躺平喔 💤'
    ],
    bard: [
      '星河低垂夜已深，願君早歇養精神 🌙🎵',
      '月照寒窗萬籟靜，莫教熬夜損芳心 ⭐🎶'
    ]
  }
};

// ── 星期感知語料庫 ──
const WEEKDAY_LINES = {
  monday: [
    '星期一開機暖身中…先不求完美，有開始就很厲害啦 💪',
    '週一症候群退散！奇異鳥發射元氣光波～✨',
    '星期一就像剛醒來的羽毛，慢慢理順就會順手囉！'
  ],
  wednesday: [
    '已經星期三了！這週撐過一半囉，小週末加油 🎉',
    '週三中場休息，補一口能量繼續往前衝～'
  ],
  friday: [
    '星期五啦！！空氣裡是不是飄著放假的味道～🎉✨',
    '撐完今天就是週末了，奇異鳥已經在偷偷歡呼囉！',
    '週五下班倒數中，再堅持一下下就自由啦 🥳'
  ],
  weekend: [
    '週末就是拿來放慢腳步、做自己喜歡的事的日子呀 ☀️',
    '放假就是要鬆鬆軟軟地待著，跟我一樣當顆快樂毛球～🥝',
    '週末愉快！今天不用趕進度，想發呆多久都可以 ✨'
  ]
};

// ── 使用情境專屬彩蛋語料庫 ──
const SCENARIO_LINES = {
  developer: [
    '這段程式既然能跑…要動它之前記得先 git commit 喔 💻',
    '遇上奇怪的 Bug 別慌，把問題講出來常常講一半就想到解法了！',
    '橡皮鴨除錯法升級版：奇異鳥除錯法！隨時講給我聽 🐥💻',
    '看太久 Log 眼睛會花掉，先喝口水回來搞不好一眼就看到根因 👀',
    '寫完一個功能記得順手跑個測試，安心感會瞬間爆棚 ✅',
    '剛才那行報錯看起來很兇，但拆開來看通常只是小地方漏掉而已～',
    '命名是世界級難題呢…想不到好名字也可以找我一起想喔！',
    '別忘了存檔！Ctrl+S 是這個世界上最令人安心的快捷鍵 💾',
    '重構一時爽，測試保平安～慢慢來比較快喔 ⚙️',
    '偶爾把複雜問題切成三塊小步驟，處理起來會順超多！'
  ],
  office: [
    '長篇信件寫完前先停三秒檢查收件人跟附件，零失誤最安心 📧',
    '事情很多的時候，挑最重要的前三件先做完，焦慮就會少一半 📊',
    '開會前喝口水清清喉嚨，簡報一定會順順利利的！',
    '遇到很難回的訊息別急著秒回，先整理三個重點再下筆 ✨',
    '剛處理完一件雜事的話，記得在待辦清單打個勾，超有成就感 ✅',
    '信件語氣太硬或太長都可以丟給我幫忙潤飾喔 📝',
    '工作是做不完的，但照顧好自己的專注節奏很重要～'
  ],
  study: [
    '看不懂的地方其實正是大腦正在長新連結的瞬間喔 📚✨',
    '讀完一段試著用自己的話講一遍，記憶力會直接翻倍！',
    '專注 25 分鐘休息 5 分鐘，學習效率比硬撐兩小時高很多喔 ⏳',
    '背不起來的單字就造一個好笑的句子，保證一秒記牢～',
    '今天的每一頁筆記，都在默默幫未來的你鋪路呢 🌱',
    '有卡住的觀念隨時問我，我們把它拆成白話慢慢看！',
    '別小看每天前進的一小步，累積一個月會很驚人的 ✨'
  ],
  creative: [
    '靈感常常不是硬擠出來的，去倒杯水走兩步說不定就掉下來了 ✍️',
    '第一版草稿本來就不需要完美，先寫出來再慢慢雕琢吧 ✨',
    '如果標題卡住了，試著換一個完全相反的角度說說看！',
    '好點子像流星一樣閃得很快，想到關鍵字就先隨手記下來吧 📝',
    '把兩個看起來不相干的元素拼在一起，常常會蹦出超棒的創意 💡',
    '偶爾讀出自己寫的句子，順不順口耳朵一聽就知道囉～',
    '腦袋空白的時候，就讓我陪你隨便聊聊找火花吧！'
  ],
  companion: [
    '不管今天順不順利，你已經很努力了喔，抱一下～🧸',
    '累了的話靠在椅背上放空一下吧，什麼都不用想也沒關係 ☁️',
    '記得多喝點溫水，把自己照顧好是最重要的事 💧',
    '就算什麼都沒做的一天，也是很值得被溫柔對待的一天 ✨',
    '我在這裡陪著你，不會催你、也不會吵你 🥝💛',
    '深吸一口氣…再慢慢吐氣…是不是覺得心裡輕一點了呢？',
    '有心事想吐吐苦水，隨時點我一下我都會認真聽喔 🐥'
  ],
  general: [
    '需要記待辦或設鬧鐘的話，直接用講的我就會幫你記下來喔 📋',
    '複製到奇怪的報錯或英文段落？開啟剪貼簿感知我也能主動幫你看！',
    '偶爾換個新帽子或新飾品，換換桌面心情也不錯呢 🎩',
    '點我一下就能聊天，也可以輸入 /help 看看我的小工具喔 ✨'
  ]
};

// ── 即時狀態語料庫（飢餓、心情、CPU、待辦、夢話） ──
const STATE_LINES = {
  hungry: {
    default: [
      '咕嚕嚕…肚子好像有點空空的，好想吃奇異果喔 🥝',
      '偷偷晃晃小肚子…主人有空可以餵我吃點東西嗎？(๑´ڡ`๑)',
      '能量快見底啦，給我一口點心就能滿血復活！🍎',
      '聞到空氣裡好像有水果的香味…原來是我在幻想 🥝💦'
    ],
    grumpy: [
      '喂…本鳥的肚子在抗議了啦，是不是該進貢點心了？🥝',
      '才不是在撒嬌，只是餓著肚子沒辦法好好幫你工作而已。',
      '右鍵餵食又不花多少時間，快點啦～🍎'
    ],
    bard: [
      '腹中空鳴如鼓響，願乞鮮果慰饑腸 🥝🎵',
      '一果入腹生神力，再為君前奏雅章 🍎🎶'
    ]
  },
  lowMood: {
    default: [
      '有點想被摸摸頭…毛茸茸的奇異鳥等你來擼喔 (´,,•ω•,,)',
      '小聲哼著歌，如果有人摸摸我一定馬上開心起來 🐥',
      '垂著小小翅膀晃呀晃，求一個溫暖的摸摸～✨',
      '覺得有點孤單的時候，看看你就會好很多了呢 💛'
    ],
    grumpy: [
      '哼，都沒理我…現在過來摸摸的話我就不計較了。',
      '本鳥今天心情有點陰天，快用摸摸把我哄晴啦。'
    ],
    bard: [
      '獨坐案隅意微涼，盼君輕撫暖羽裳 🎵',
      '一撫生春百憂散，重展歡顏伴君旁 🎶'
    ]
  },
  highCpu: {
    default: [
      '呼呼…電腦好像在全力衝刺，風扇都起飛啦！💦',
      'CPU 好忙碌喔，我用短短的小翅膀幫電腦搧搧風～🌀',
      '感覺腳底的螢幕溫溫熱熱的，電腦辛苦了！💻💦',
      '系統火力全開中！趁電腦算東西的空檔伸個懶腰吧 ✨'
    ],
    grumpy: [
      '喂，電腦燙到本鳥腳底都熱呼呼的了啦！開了幾個分頁啊？💦',
      '風扇轉這麼大聲，它比你還拼命耶…稍微關幾個用不到的視窗吧。'
    ],
    bard: [
      '機心疾轉如奔雷，且扇微風散熱煨 💻🎵'
    ]
  },
  dream: [
    'Zzz... 好大一顆閃閃發光的奇異果... 🥝',
    '呼嚕... 飛起來了... 原來我的翅膀這麼長... ☁️',
    'Zzz... 主人別跑... 再摸一下下... 💤',
    '嗯呢... 滿滿一桌都是點心... 🍎',
    'Zzz... 抓到那個紅點點了... 嘿嘿... 🔴',
    '呼呼... 軟綿綿的雲朵被窩... ☁️💤',
    'Zzz... 沒有 Bug 的和平世界... ✨',
    '咕啾... 明天也要一起玩喔... 💤',
    'Zzz... 滑鼠變成蝴蝶飛走了... 🦋',
    '呼嚕嚕... 暖呼呼的太陽... ☀️💤',
    'Zzz... 戴著皇冠在草地散步... 👑',
    '嗯嗯... 再睡五分鐘就好... 💤',
    'Zzz... 所有的鬧鐘都變成搖籃曲... 🎵',
    '呼呼... 星星掉進碗裡了... ⭐'
  ]
};

// ── 動態組合句積木（大幅擴充不重複變化） ──
const COMBO_PARTS = {
  default: {
    openers: [
      '偷偷說喔，',
      '剛剛發呆的時候突然想到，',
      '晃了晃圓圓的腦袋，覺得',
      '拍拍羽毛小聲提醒：',
      '看了一圈桌面覺得，',
      '靈機一動！其實',
      '小聲嘀咕一句：'
    ],
    middles: [
      '把大任務切成 10 分鐘的小步驟，做起來會輕鬆很多',
      '適時站起來倒杯溫水，回來思路會更清楚',
      '今天已經默默完成了不少進度，別對自己太嚴格',
      '偶爾看看遠處的綠色風景，眼睛會非常感謝你',
      '深呼吸三次，把緊繃的肩膀放鬆下來吧',
      '不管進度快或慢，有在前進就是很棒的事',
      '累了就稍微放空半分鐘，充電完再出發',
      '記得保持舒服的坐姿，別不知不覺貼到螢幕前囉',
      '把腦袋裡雜亂的事寫進待辦清單，心裡會清淨好多'
    ],
    closers: [
      '喔～(•ө•)',
      '呢 ✨',
      '啦 🥝',
      '喔！(๑•̀ㅂ•́)و✧',
      '～🐥',
      '喔 (⁎˃ᴗ˂⁎)'
    ]
  },
  grumpy: {
    openers: [
      '喂，先說好我不是在關心你喔，只是',
      '哼，本鳥順口提醒一句：',
      '真受不了，',
      '別裝沒聽到喔，',
      '看你這麼認真就勉為其難說一下：'
    ],
    middles: [
      '坐太久腰會抗議的，起來伸個懶腰',
      '喝口水又花不了五秒鐘',
      '眼睛盯太緊會乾澀，眨眨眼看遠方',
      '事情拆小一點做才不會把自己累壞',
      '累了就休息一下，硬撐效率又不會比較高',
      '有需要幫忙就開口，別一個人悶著頭硬扛'
    ],
    closers: [
      '啦。',
      '好不好 (¬_¬)',
      '喔，記住了沒？',
      '，本鳥才不會提醒第二次呢。'
    ]
  },
  bard: {
    openers: [
      '輕撫羽弦低聲唱：',
      '微風掠過寄一言：',
      '聽吾桌畔吟短句：',
      '星光閃爍語輕柔：'
    ],
    middles: [
      '暫歇雙眸看遠岫，清心如水自悠遊',
      '一盞清茶添雅意，舒肩展臂氣如虹',
      '繁事細分如落葉，輕掃之間路自通',
      '莫急莫躁循微步，日積月累見奇功',
      '靜氣深呼消百慮，明朝回首笑從容'
    ],
    closers: [
      ' 🎵',
      ' 🎶',
      ' ✨🎵'
    ]
  }
};

function getTimeSlot(date = new Date()) {
  const h = date.getHours();
  if (h >= 6 && h < 11.5) return 'morning';
  if (h >= 11.5 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22.5) return 'evening';
  return 'lateNight';
}

function getWeekdaySlot(date = new Date()) {
  const day = date.getDay();
  if (day === 1) return 'monday';
  if (day === 3) return 'wednesday';
  if (day === 5) return 'friday';
  if (day === 0 || day === 6) return 'weekend';
  return null;
}

function normalizeVoice(personality = 'default') {
  const p = String(personality || 'default').toLowerCase();
  if (p === 'grumpy' || p === 'bard') return p;
  return 'default';
}

function getNextDelayMs(frequency = 'normal', rng = Math.random) {
  const preset = FREQUENCY_PRESETS[frequency] || FREQUENCY_PRESETS.normal;
  const span = Math.max(0, preset.maxMs - preset.minMs);
  return Math.round(preset.minMs + rng() * span);
}

function formatTodoLines(pendingTodos, voice) {
  if (!Array.isArray(pendingTodos) || pendingTodos.length === 0) return [];
  const count = pendingTodos.length;
  const lines = [];

  if (voice === 'grumpy') {
    lines.push(`待辦清單裡還有 ${count} 件事排隊中喔，別假裝忘記了啦 📋`);
    lines.push(`哼，那 ${count} 件待辦再放下去都要發芽囉，挑一件先解決吧。`);
  } else if (voice === 'bard') {
    lines.push(`案頭猶存 ${count} 件願，逐一輕成意自歡 📋🎵`);
  } else {
    lines.push(`偷偷瞄了一眼待辦清單，還有 ${count} 件事等著打勾呢 📋`);
    lines.push(`還有 ${count} 件待辦在排隊，先挑最輕鬆的那一件解決吧！(•ө•)`);
  }

  // 針對具體未完成待辦生成個人化句子
  pendingTodos.slice(0, 4).forEach((todo) => {
    const raw = (todo && todo.text ? String(todo.text) : '').trim();
    if (!raw) return;
    const shortTitle = raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
    if (voice === 'grumpy') {
      lines.push(`「${shortTitle}」這件事弄完了沒呀？做完記得去打勾喔 📋`);
    } else if (voice === 'bard') {
      lines.push(`莫忘「${shortTitle}」待君成，一筆勾銷滿心晴 📋🎶`);
    } else {
      lines.push(`小聲提醒～「${shortTitle}」還沒打勾喔，有空可以看看 📋`);
      lines.push(`「${shortTitle}」如果已經做完的話，記得去打勾收穫成就感喔 ✨`);
    }
  });

  return lines;
}

function collectOutfitLines(outfits, voice) {
  if (!Array.isArray(outfits) || outfits.length === 0) return [];
  const lines = [];
  outfits.forEach((item) => {
    const entry = OUTFIT_REACTIONS[item];
    if (!entry) return;
    const matched = entry[voice] || entry.default || [];
    lines.push(...matched);
  });
  return lines;
}

function generateCombinatorialCandidates(voice, count = 12, rng = Math.random) {
  const parts = COMBO_PARTS[voice] || COMBO_PARTS.default;
  const out = [];
  const seen = new Set();
  const maxAttempts = count * 4;
  for (let i = 0; i < maxAttempts && out.length < count; i++) {
    const o = parts.openers[Math.floor(rng() * parts.openers.length)];
    const m = parts.middles[Math.floor(rng() * parts.middles.length)];
    const c = parts.closers[Math.floor(rng() * parts.closers.length)];
    const text = `${o}${m}${c}`;
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/**
 * 帶滑動防重複視窗與連續類別防護的自言自語挑選器
 */
class MonologuePicker {
  constructor(options = {}) {
    this.historyLimit = options.historyLimit || 40;
    this.recentTexts = [];
    this.lastCategory = null;
  }

  recordSpoken(text, category = 'general') {
    if (!text) return;
    this.recentTexts.push(text);
    if (this.recentTexts.length > this.historyLimit) {
      this.recentTexts.shift();
    }
    this.lastCategory = category;
  }

  getRecentTexts(limit = 5) {
    return this.recentTexts.slice(-limit);
  }

  reset() {
    this.recentTexts = [];
    this.lastCategory = null;
  }

  /**
   * 根據即時環境狀態挑選一句高多樣性、低重複率的自言自語
   */
  pick(context = {}, rng = Math.random) {
    const now = context.now instanceof Date ? context.now : new Date();
    const voice = normalizeVoice(context.personality);
    const scenarioId = String(context.scenario || 'general').toLowerCase();
    const isSleeping = Boolean(context.isSleeping);
    const hunger = typeof context.hunger === 'number' ? context.hunger : 100;
    const mood = typeof context.mood === 'number' ? context.mood : 100;
    const cpuUsage = typeof context.cpuUsage === 'number' ? context.cpuUsage : 0;
    const todos = Array.isArray(context.todos) ? context.todos : [];
    const pendingTodos = todos.filter((t) => t && !t.done);
    const outfits = Array.isArray(context.outfits) ? context.outfits : [];

    // 睡覺狀態：只從夢話庫挑選（帶防重複）
    if (isSleeping) {
      const dreamText = this._pickFromPool(STATE_LINES.dream, rng);
      this.recordSpoken(dreamText, 'dream');
      return { text: dreamText, category: 'dream', isDream: true };
    }

    // 依即時狀態建構加權候選分類
    const buckets = [];
    const addBucket = (category, weight, lines) => {
      const valid = Array.isArray(lines) ? lines.filter(Boolean) : [];
      if (valid.length > 0 && weight > 0) {
        buckets.push({ category, weight, lines: valid });
      }
    };

    // 基礎日常與動態組合
    addBucket('general', 28, GENERAL_LINES[voice] || GENERAL_LINES.default);
    addBucket('combo', 16, generateCombinatorialCandidates(voice, 14, rng));

    // 時段與星期
    const timeSlot = getTimeSlot(now);
    const timePool = (TIME_LINES[timeSlot] && (TIME_LINES[timeSlot][voice] || TIME_LINES[timeSlot].default)) || [];
    addBucket('time', 18, timePool);

    const weekdaySlot = getWeekdaySlot(now);
    if (weekdaySlot && WEEKDAY_LINES[weekdaySlot]) {
      addBucket('weekday', 10, WEEKDAY_LINES[weekdaySlot]);
    }

    // 使用情境彩蛋
    const scenarioPool = SCENARIO_LINES[scenarioId] || SCENARIO_LINES.general;
    addBucket('scenario', 18, scenarioPool);

    // 即時寵物／系統狀態加權
    if (hunger < 35) {
      addBucket('hungry', 26, STATE_LINES.hungry[voice] || STATE_LINES.hungry.default);
    }
    if (mood < 40) {
      addBucket('lowMood', 22, STATE_LINES.lowMood[voice] || STATE_LINES.lowMood.default);
    }
    if (cpuUsage > 70) {
      addBucket('highCpu', 24, STATE_LINES.highCpu[voice] || STATE_LINES.highCpu.default);
    }
    if (pendingTodos.length > 0) {
      addBucket('todo', 14, formatTodoLines(pendingTodos, voice));
    }
    const outfitLines = collectOutfitLines(outfits, voice);
    if (outfitLines.length > 0) {
      addBucket('outfit', 12, outfitLines);
    }

    // 優先過濾掉「完全沒有未說過句子的分類」與「剛說過的同分類」
    const recentSet = new Set(this.recentTexts);
    let freshBuckets = buckets
      .map((b) => ({
        ...b,
        freshLines: b.lines.filter((line) => !recentSet.has(line))
      }))
      .filter((b) => b.freshLines.length > 0);

    // 若全部句庫都被說完一輪，放寬為僅避開最近 10 句
    if (freshBuckets.length === 0) {
      const tightRecent = new Set(this.recentTexts.slice(-10));
      freshBuckets = buckets
        .map((b) => ({
          ...b,
          freshLines: b.lines.filter((line) => !tightRecent.has(line))
        }))
        .filter((b) => b.freshLines.length > 0);
    }

    if (freshBuckets.length === 0) {
      freshBuckets = buckets.map((b) => ({ ...b, freshLines: b.lines }));
    }

    // 避免連續兩次抽到完全相同的分類（例如連續兩句待辦或連續兩句時段）
    const nonRepeatCatBuckets = freshBuckets.filter((b) => b.category !== this.lastCategory);
    const poolToPick = nonRepeatCatBuckets.length > 0 ? nonRepeatCatBuckets : freshBuckets;

    const chosenBucket = this._weightedPick(poolToPick, rng);
    const chosenText = chosenBucket.freshLines[Math.floor(rng() * chosenBucket.freshLines.length)];

    this.recordSpoken(chosenText, chosenBucket.category);
    return {
      text: chosenText,
      category: chosenBucket.category,
      isDream: false
    };
  }

  _pickFromPool(pool, rng) {
    const recentSet = new Set(this.recentTexts);
    const fresh = pool.filter((line) => !recentSet.has(line));
    const candidates = fresh.length > 0 ? fresh : pool;
    return candidates[Math.floor(rng() * candidates.length)];
  }

  _weightedPick(buckets, rng) {
    const total = buckets.reduce((sum, b) => sum + b.weight, 0);
    let threshold = rng() * total;
    for (const b of buckets) {
      threshold -= b.weight;
      if (threshold <= 0) return b;
    }
    return buckets[buckets.length - 1];
  }
}

/**
 * 建構低 Token 消耗的 AI 即興自言自語提示詞（選配啟用）
 */
function buildAIMonologuePrompt(context = {}) {
  const now = context.now instanceof Date ? context.now : new Date();
  const timeSlotMap = {
    morning: '早晨',
    noon: '中午',
    afternoon: '下午',
    evening: '傍晚',
    lateNight: '深夜'
  };
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const slotLabel = timeSlotMap[getTimeSlot(now)] || '日常';
  const dayLabel = dayNames[now.getDay()] || '';
  const personality = context.personality || 'default';
  const customPrompt = (context.customPrompt || '').trim();
  const scenario = context.scenario || 'general';
  const recent = Array.isArray(context.recentTexts) ? context.recentTexts.slice(-5) : [];

  let voiceHint = '親切活潑帶點可愛的桌面奇異鳥';
  if (personality === 'grumpy') voiceHint = '傲嬌、嘴硬心軟、有點慵懶的奇異鳥';
  else if (personality === 'bard') voiceHint = '西式奇幻風格、會押韻帶詩意的吟遊詩人奇異鳥（禁用中國古詩詞）';
  else if (personality === 'custom' && customPrompt) voiceHint = `遵循自訂性格「${customPrompt}」的奇異鳥`;

  const stateHints = [];
  if (typeof context.hunger === 'number' && context.hunger < 35) stateHints.push('現在有點肚子餓');
  if (typeof context.mood === 'number' && context.mood < 40) stateHints.push('有點想被摸摸');
  if (typeof context.cpuUsage === 'number' && context.cpuUsage > 70) stateHints.push('電腦風扇正高速運轉有點熱');
  if (Array.isArray(context.outfits) && context.outfits.length > 0) {
    stateHints.push(`身上戴著 ${context.outfits.join(' ')}`);
  }

  const avoidBlock = recent.length > 0
    ? `\n避免重複以下剛說過的主題或句子：\n- ${recent.join('\n- ')}`
    : '';

  return `你是桌面奇異鳥 Wiki Wiki，性格為：${voiceHint}。
現在是 ${dayLabel}${slotLabel}，目前背景偏向 ${scenario}${stateHints.length ? `，狀態：${stateHints.join('、')}` : ''}。
請自然地說「一句」簡短的內心自言自語或生活小觀察（繁體中文、12~26 字以內、不要加引號、不要唸出模式名稱、不要自稱工程師或秘書等職業頭銜）。${avoidBlock}`;
}

module.exports = {
  FREQUENCY_PRESETS,
  OUTFIT_REACTIONS,
  GENERAL_LINES,
  TIME_LINES,
  WEEKDAY_LINES,
  SCENARIO_LINES,
  STATE_LINES,
  MonologuePicker,
  getTimeSlot,
  getWeekdaySlot,
  getNextDelayMs,
  buildAIMonologuePrompt
};
