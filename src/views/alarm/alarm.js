require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ipcRenderer } = require('electron');

ipcRenderer.on('reload-data', () => {
  loadAlarms();
});

const { alarmsPath, petStatePath } = require('../../utils/paths');
let alarms = [];
let todos = [];

const btnOpenAdd = document.getElementById('btn-open-add');
const alarmList = document.getElementById('alarm-list');

let isCreatingDraft = false;
let activeEditId = null;
let inlineFormSeq = 0;

function formatLocalDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowLocal() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return {
    todayStr: formatLocalDate(now),
    tomorrowStr: formatLocalDate(tomorrow),
    currentTimeStr: `${hours}:${minutes}`,
    currentH: hours,
    currentM: minutes
  };
}

function addDaysLocal(offsetDays) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return formatLocalDate(target);
}

function formatDateChipLabel(dateStr) {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${dateStr} (${dayNames[d.getDay()]})`;
}

function normalizeAlarmDates(alarm) {
  const raw = [];
  if (alarm && Array.isArray(alarm.dates)) {
    raw.push(...alarm.dates);
  }
  if (alarm && typeof alarm.date === 'string' && alarm.date.trim()) {
    raw.push(alarm.date.trim());
  }
  const validSet = new Set(
    raw
      .map(d => (typeof d === 'string' ? d.trim() : ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );
  return Array.from(validSet).sort();
}

function computeOnceTargetDate(timeStr, nowInfo = getNowLocal()) {
  if (!timeStr) return nowInfo.todayStr;
  return timeStr < nowInfo.currentTimeStr ? nowInfo.tomorrowStr : nowInfo.todayStr;
}

function parseTimeString(str) {
  if (!str) return null;
  const trimmed = str.trim();
  let h, m;
  const colonMatch = trimmed.match(/^(\d{1,2})[:：](\d{1,2})$/);
  if (colonMatch) {
    h = parseInt(colonMatch[1], 10);
    m = parseInt(colonMatch[2], 10);
  } else {
    const numMatch = trimmed.match(/^(\d{1,2})(\d{2})$/);
    if (numMatch) {
      h = parseInt(numMatch[1], 10);
      m = parseInt(numMatch[2], 10);
    }
  }
  if (h !== undefined && m !== undefined && h >= 0 && h < 24 && m >= 0 && m < 60) {
    const formattedH = h.toString().padStart(2, '0');
    const formattedM = m.toString().padStart(2, '0');
    return {
      h: formattedH,
      m: formattedM,
      formatted: `${formattedH}:${formattedM}`
    };
  }
  return null;
}

function notifyAlarmEnabled(alarm) {
  const dates = normalizeAlarmDates(alarm);
  ipcRenderer.send('alarm-enabled-notify', {
    id: alarm.id,
    type: alarm.type,
    time: alarm.time,
    targetDate: alarm.targetDate || '',
    date: dates[0] || alarm.date || '',
    dates: dates,
    days: alarm.days,
    message: alarm.message
  });
}

function loadAlarms() {
  if (fs.existsSync(alarmsPath)) {
    try {
      const data = fs.readFileSync(alarmsPath, 'utf8');
      alarms = JSON.parse(data);
      alarms.forEach(a => {
        if (!a.type) {
          a.type = 'weekly';
          a.days = [0, 1, 2, 3, 4, 5, 6];
        } else if (a.type === 'date') {
          const normalizedDates = normalizeAlarmDates(a);
          a.dates = normalizedDates;
          a.date = normalizedDates[0] || '';
        }
      });
    } catch (e) {
      console.error('Failed to parse alarms:', e);
      alarms = [];
    }
  } else {
    alarms = [];
  }
  
  if (fs.existsSync(petStatePath)) {
    try {
      const petStateData = JSON.parse(fs.readFileSync(petStatePath, 'utf8'));
      todos = petStateData.todos || [];
    } catch (e) {
      todos = [];
    }
  }

  alarms.sort((a, b) => a.time.localeCompare(b.time));
  renderAlarms();
}

function saveAlarms() {
  try {
    fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
    ipcRenderer.send('alarms-changed');
  } catch (e) {
    console.error('Failed to save alarms:', e);
  }
}

// iOS 鬧鐘風格 3D 滾輪選擇器元件
function setupIosWheelPicker(formCard, hourSelect, minSelect) {
  const ITEM_HEIGHT = 36;
  const VISIBLE_COUNT = 5;
  const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 180
  const CENTER_OFFSET = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 72
  const CYCLES = 5;
  const MID_CYCLE = 2;

  const hourScroll = formCard.querySelector('.wheel-hour-scroll');
  const minScroll = formCard.querySelector('.wheel-min-scroll');

  if (!hourScroll || !minScroll) return null;

  function createColumnWheel(scrollEl, totalVals, selectEl) {
    const cycleHeight = totalVals * ITEM_HEIGHT;
    const minThreshold = 1 * cycleHeight;
    const maxThreshold = 3 * cycleHeight;

    const items = [];
    scrollEl.innerHTML = '';

    for (let c = 0; c < CYCLES; c++) {
      for (let v = 0; v < totalVals; v++) {
        const item = document.createElement('div');
        item.className = 'ios-wheel-item';
        item.dataset.val = v;
        item.dataset.index = items.length;
        item.textContent = v.toString().padStart(2, '0');
        scrollEl.appendChild(item);
        items.push(item);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.classList.contains('is-disabled')) return;
          const idx = parseInt(item.dataset.index, 10);
          scrollToIndex(idx, true);
          const chosenVal = (idx % totalVals + totalVals) % totalVals;
          const strVal = chosenVal.toString().padStart(2, '0');
          if (selectEl.value !== strVal) {
            isInternalChange = true;
            selectEl.value = strVal;
            selectEl.dispatchEvent(new Event('change'));
            isInternalChange = false;
          }
        });
      }
    }

    let isResetting = false;
    let isInternalChange = false;
    let scrollDebounceTimer = null;
    let lastCenterIndex = -1;

    function scrollToIndex(idx, smooth = true) {
      const targetTop = idx * ITEM_HEIGHT - CENTER_OFFSET;
      if (typeof scrollEl.scrollTo === 'function') {
        scrollEl.scrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        scrollEl.scrollTop = targetTop;
      }
      updateVisuals();
    }

    function scrollToVal(val, smooth = true) {
      const idx = MID_CYCLE * totalVals + val;
      scrollToIndex(idx, smooth);
    }

    function updateVisuals() {
      const currentScroll = scrollEl.scrollTop;
      const centerIndex = Math.round((currentScroll + CENTER_OFFSET) / ITEM_HEIGHT);

      if (centerIndex === lastCenterIndex) return;

      if (lastCenterIndex >= 0) {
        for (let i = lastCenterIndex - 3; i <= lastCenterIndex + 3; i++) {
          if (items[i]) {
            items[i].classList.remove('is-selected', 'is-near-1', 'is-near-2');
          }
        }
      }

      lastCenterIndex = centerIndex;

      for (let offset = -2; offset <= 2; offset++) {
        const targetIdx = centerIndex + offset;
        const item = items[targetIdx];
        if (item) {
          if (offset === 0) {
            item.classList.add('is-selected');
          } else if (Math.abs(offset) === 1) {
            item.classList.add('is-near-1');
          } else if (Math.abs(offset) === 2) {
            item.classList.add('is-near-2');
          }
        }
      }
    }

    function onScrollStop() {
      const currentScroll = scrollEl.scrollTop;
      const centerIndex = Math.round((currentScroll + CENTER_OFFSET) / ITEM_HEIGHT);
      let val = (centerIndex % totalVals + totalVals) % totalVals;

      const item = items[centerIndex];
      if (item && item.classList.contains('is-disabled')) {
        let forwardIdx = centerIndex;
        while (items[forwardIdx] && items[forwardIdx].classList.contains('is-disabled')) {
          forwardIdx++;
        }
        if (items[forwardIdx]) {
          scrollToIndex(forwardIdx, true);
          val = (forwardIdx % totalVals + totalVals) % totalVals;
        }
      }

      const strVal = val.toString().padStart(2, '0');
      if (selectEl.value !== strVal) {
        isInternalChange = true;
        selectEl.value = strVal;
        selectEl.dispatchEvent(new Event('change'));
        isInternalChange = false;
      }
    }

    scrollEl.addEventListener('scroll', () => {
      if (isResetting) return;

      const currentScroll = scrollEl.scrollTop;
      if (currentScroll < minThreshold) {
        isResetting = true;
        const offset = currentScroll + cycleHeight;
        scrollEl.scrollTop = offset;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => { isResetting = false; });
        } else {
          isResetting = false;
        }
      } else if (currentScroll > maxThreshold) {
        isResetting = true;
        const offset = currentScroll - cycleHeight;
        scrollEl.scrollTop = offset;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => { isResetting = false; });
        } else {
          isResetting = false;
        }
      }

      updateVisuals();

      clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = setTimeout(onScrollStop, 90);
    });

    // 支援像手機一樣的滑鼠拖拽上下滑動
    let isDragging = false;
    let startY = 0;
    let startScroll = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startY = e.clientY;
      startScroll = scrollEl.scrollTop;
      scrollEl.style.scrollSnapType = 'none';
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      scrollEl.scrollTop = startScroll - deltaY;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      scrollEl.style.scrollSnapType = 'y mandatory';
      onScrollStop();
    };

    scrollEl.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    selectEl.addEventListener('change', () => {
      if (isInternalChange) return;
      const val = parseInt(selectEl.value, 10);
      if (!isNaN(val)) {
        scrollToVal(val, true);
      }
    });

    return {
      scrollToVal,
      updateDisabled(disabledFn) {
        items.forEach(item => {
          const val = parseInt(item.dataset.val, 10);
          item.classList.toggle('is-disabled', disabledFn(val));
        });
      },
      destroy() {
        scrollEl.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    };
  }

  const hourWheel = createColumnWheel(hourScroll, 24, hourSelect);
  const minWheel = createColumnWheel(minScroll, 60, minSelect);

  return {
    syncToCurrent(smooth = false) {
      const h = parseInt(hourSelect.value, 10) || 0;
      const m = parseInt(minSelect.value, 10) || 0;
      hourWheel.scrollToVal(h, smooth);
      minWheel.scrollToVal(m, smooth);
    },
    updateRestrictions(isToday, curHInt, curMInt, selectedHInt) {
      hourWheel.updateDisabled(h => isToday && h < curHInt);
      minWheel.updateDisabled(m => isToday && selectedHInt === curHInt && m < curMInt);
    },
    destroy() {
      hourWheel.destroy();
      minWheel.destroy();
    }
  };
}

function createAlarmInlineForm(initialData, isDraft, onSave, onCancel) {
  const formCard = document.createElement('div');
  formCard.className = 'inline-form-card';

  const { todayStr, currentTimeStr } = getNowLocal();
  const radioGroupName = `inline-alarm-type-${++inlineFormSeq}`;

  const data = initialData ? { ...initialData } : {
    type: 'once',
    date: todayStr,
    dates: [],
    time: currentTimeStr,
    days: [0, 1, 2, 3, 4, 5, 6],
    message: '',
    snoozeInterval: 5
  };

  if (!['once', 'weekly', 'date'].includes(data.type)) {
    data.type = 'weekly';
  }

  let selectedDates = [];
  if (data.type === 'date') {
    const existingDates = normalizeAlarmDates(data);
    const nonPastDates = existingDates.filter(d => d >= todayStr);
    if (nonPastDates.length === 0) {
      // 需求 4：若編輯時原本全都是過去日期，自動預設為今天與當下時間
      selectedDates = [todayStr];
      data.date = todayStr;
      data.time = currentTimeStr;
    } else {
      selectedDates = nonPastDates;
      data.date = selectedDates[0];
      if (selectedDates.includes(todayStr) && (data.time || '') < currentTimeStr) {
        data.time = currentTimeStr;
      }
    }
  }

  const [initH, initM] = (data.time || currentTimeStr).split(':');

  formCard.innerHTML = `
    <div class="inline-form-row inline-type-row">
      <label class="inline-type-option"><input type="radio" class="inline-type-radio" name="${radioGroupName}" value="once" ${data.type === 'once' ? 'checked' : ''}> ⚡ 一次性</label>
      <label class="inline-type-option"><input type="radio" class="inline-type-radio" name="${radioGroupName}" value="weekly" ${data.type === 'weekly' ? 'checked' : ''}> 🔁 每週重複</label>
      <label class="inline-type-option"><input type="radio" class="inline-type-radio" name="${radioGroupName}" value="date" ${data.type === 'date' ? 'checked' : ''}> 📅 特定日期</label>
    </div>

    <div class="inline-once-group" style="display: ${data.type === 'once' ? 'block' : 'none'};">
      <div class="inline-once-hint"></div>
    </div>

    <div class="inline-weekly-group" style="display: ${data.type === 'weekly' ? 'block' : 'none'};">
      <div class="days-selector" style="display: flex; gap: 4px; justify-content: space-between;">
        ${['日','一','二','三','四','五','六'].map((day, idx) => `
          <label class="day-chip">
            <input type="checkbox" class="inline-day-cb" value="${idx}" ${(data.days || []).includes(idx) ? 'checked' : ''}>
            <span>${day}</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div class="inline-date-group" style="display: ${data.type === 'date' ? 'block' : 'none'};">
      <div class="date-picker-row">
        <input type="date" class="inline-date-input" min="${todayStr}" value="${selectedDates[0] || todayStr}">
        <button type="button" class="btn-add-date" title="將目前選取的日期加入清單">➕ 加入</button>
      </div>
      <div class="date-quick-row">
        <button type="button" class="btn-quick-date" data-offset-days="0">今天</button>
        <button type="button" class="btn-quick-date" data-offset-days="1">明天</button>
        <button type="button" class="btn-quick-date" data-offset-days="2">後天</button>
        <span class="date-count-hint"></span>
      </div>
      <div class="selected-dates-list"></div>
    </div>

    <div class="inline-form-row space-between" style="font-size: 13px; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">時間:</span>
        <div class="time-combobox-wrapper">
          <div class="time-combobox-field">
            <span class="time-combobox-icon">⏰</span>
            <input type="text" class="inline-time-input" placeholder="HH:mm" maxlength="5" value="${initH}:${initM}" title="可直接鍵盤輸入 (例如 08:30)，或點右側下拉選擇">
            <button type="button" class="btn-time-dropdown" title="展開時間選擇選單">▾</button>
          </div>
          
          <div class="time-dropdown-popover" style="display: none;">
            <!-- 保持無障礙與自動化測試相容之原生 select (隱藏於視覺但保留於 DOM) -->
            <select class="inline-hour-select" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;"></select>
            <select class="inline-minute-select" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;"></select>

            <!-- iOS 鬧鐘風格 3D 滾輪選擇器 -->
            <div class="ios-time-picker-wrapper">
              <div class="ios-picker-header">
                <span class="ios-picker-label">時</span>
                <span class="ios-picker-label">分</span>
              </div>
              <div class="ios-wheel-container">
                <!-- 置中選擇鏡頭高亮 -->
                <div class="ios-wheel-lens"></div>
                <!-- 3D 圓柱漸變遮罩 -->
                <div class="ios-wheel-mask top-mask"></div>
                <div class="ios-wheel-mask bottom-mask"></div>

                <!-- 小時滾輪 (無限循環) -->
                <div class="ios-wheel-col" data-unit="hour">
                  <div class="ios-wheel-scroll wheel-hour-scroll"></div>
                </div>

                <div class="ios-wheel-colon">:</div>

                <!-- 分鐘滾輪 (無限循環) -->
                <div class="ios-wheel-col" data-unit="minute">
                  <div class="ios-wheel-scroll wheel-min-scroll"></div>
                </div>
              </div>
            </div>

            <div class="time-picker-quick">
              <button type="button" class="btn-quick-time" data-offset="0">現在</button>
              <button type="button" class="btn-quick-time" data-offset="15">+15分</button>
              <button type="button" class="btn-quick-time" data-offset="30">+30分</button>
              <button type="button" class="btn-quick-time" data-offset="60">+1小時</button>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-weight: bold; color: var(--theme-text-sub);">貪睡:</span>
        <input type="number" class="inline-snooze-input" value="${data.snoozeInterval || 5}" min="1" max="60" style="width: 44px; padding: 4px 6px; border: 1.5px solid #c5e1a5; border-radius: 8px; outline: none; text-align: center; font-size: 13px;">
        <span style="color: var(--theme-text-sub);">分鐘</span>
      </div>
    </div>

    <div class="inline-form-row">
      <input type="text" class="inline-msg-input" placeholder="例如：下班囉！記得打卡！" value="${data.message || ''}" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1.5px solid #c5e1a5; border-radius: 10px; outline: none; font-size: 13px;">
    </div>

    <div class="inline-error-tip"></div>

    <div class="inline-form-row space-between" style="margin-top: 2px;">
      <div class="inline-form-actions" style="margin-left: auto;">
        <button class="btn-cancel">取消</button>
        <button class="btn-confirm">${isDraft ? '➕ 建立' : '💾 儲存'}</button>
      </div>
    </div>
  `;

  const hourSelect = formCard.querySelector('.inline-hour-select');
  const minSelect = formCard.querySelector('.inline-minute-select');
  const timeInput = formCard.querySelector('.inline-time-input');
  const dateInput = formCard.querySelector('.inline-date-input');
  const btnAddDate = formCard.querySelector('.btn-add-date');
  const quickDateBtns = formCard.querySelectorAll('.btn-quick-date');
  const dateCountHint = formCard.querySelector('.date-count-hint');
  const selectedDatesList = formCard.querySelector('.selected-dates-list');
  const onceHint = formCard.querySelector('.inline-once-hint');
  const errorTip = formCard.querySelector('.inline-error-tip');

  const showError = (msg) => {
    errorTip.textContent = `⚠️ ${msg}`;
    errorTip.style.display = 'block';
    setTimeout(() => { errorTip.style.display = 'none'; }, 3000);
  };

  for (let i = 0; i < 24; i++) {
    const val = i.toString().padStart(2, '0');
    hourSelect.add(new Option(val, val));
  }
  for (let i = 0; i < 60; i++) {
    const val = i.toString().padStart(2, '0');
    minSelect.add(new Option(val, val));
  }
  hourSelect.value = initH;
  minSelect.value = initM;

  const timeWheelPicker = setupIosWheelPicker(formCard, hourSelect, minSelect);

  const comboboxWrapper = formCard.querySelector('.time-combobox-wrapper');
  const comboboxField = formCard.querySelector('.time-combobox-field');
  const btnToggleDropdown = formCard.querySelector('.btn-time-dropdown');
  const timePopover = formCard.querySelector('.time-dropdown-popover');

  function updateOnceHint() {
    if (!onceHint) return;
    const currentNow = getNowLocal();
    const selectedTime = `${hourSelect.value}:${minSelect.value}`;
    const targetDate = computeOnceTargetDate(selectedTime, currentNow);
    const dayLabel = targetDate === currentNow.todayStr ? '今天' : '明天';
    onceHint.textContent = `⚡ 將於${dayLabel} (${targetDate}) ${selectedTime} 提醒一次並自動關閉`;
  }

  function renderSelectedDates() {
    selectedDates.sort();
    if (dateCountHint) {
      dateCountHint.textContent = selectedDates.length > 0 ? `已選 ${selectedDates.length} 天` : '尚未加入日期';
    }
    quickDateBtns.forEach(btn => {
      const offset = parseInt(btn.dataset.offsetDays, 10) || 0;
      const targetStr = addDaysLocal(offset);
      btn.classList.toggle('active', selectedDates.includes(targetStr));
    });

    if (!selectedDatesList) return;
    selectedDatesList.innerHTML = '';
    if (selectedDates.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'selected-dates-empty';
      hint.textContent = '選擇日期會自動加入，可多選多天';
      selectedDatesList.appendChild(hint);
      return;
    }

    selectedDates.forEach(d => {
      const chip = document.createElement('span');
      chip.className = 'date-tag-chip';
      chip.dataset.date = d;

      const label = document.createElement('span');
      label.textContent = formatDateChipLabel(d);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'date-tag-remove';
      removeBtn.dataset.date = d;
      removeBtn.title = `移除 ${d}`;
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedDates = selectedDates.filter(item => item !== d);
        if (selectedDates.length > 0) {
          dateInput.value = selectedDates[0];
        }
        renderSelectedDates();
        updateTimeRestrictions(false);
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      selectedDatesList.appendChild(chip);
    });
  }

  function addDateToSelection(dateStr, { silentDuplicate = false } = {}) {
    const currentNow = getNowLocal();
    if (!dateStr) {
      showError('請先選擇一個日期！');
      return false;
    }
    if (dateStr < currentNow.todayStr) {
      showError('特定日期不能選擇過去的日期！');
      return false;
    }
    if (selectedDates.includes(dateStr)) {
      if (!silentDuplicate) {
        showError(`日期 ${dateStr} 已經在清單中囉！`);
      }
      return false;
    }
    selectedDates = [...selectedDates, dateStr].sort();
    renderSelectedDates();
    updateTimeRestrictions(false);
    return true;
  }

  if (comboboxField) {
    comboboxField.addEventListener('click', (e) => {
      if (e.target !== btnToggleDropdown && !btnToggleDropdown.contains(e.target)) {
        timeInput.focus();
      }
    });
  }

  function togglePopover(show) {
    const shouldShow = (typeof show === 'boolean') ? show : (timePopover.style.display === 'none');
    timePopover.style.display = shouldShow ? 'flex' : 'none';
    btnToggleDropdown.classList.toggle('active', shouldShow);
    if (shouldShow) {
      if (typeof comboboxWrapper.getBoundingClientRect === 'function') {
        const rect = comboboxWrapper.getBoundingClientRect();
        const popoverHeight = 260;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          timePopover.style.top = 'auto';
          timePopover.style.bottom = 'calc(100% + 6px)';
        } else {
          timePopover.style.top = 'calc(100% + 6px)';
          timePopover.style.bottom = 'auto';
        }
      }
      updateTimeRestrictions(false);
      if (timeWheelPicker) {
        timeWheelPicker.syncToCurrent(false);
        setTimeout(() => {
          if (timeWheelPicker) timeWheelPicker.syncToCurrent(false);
        }, 0);
      }
    }
  }

  btnToggleDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  timeInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const onDocClick = (e) => {
    if (comboboxWrapper && !comboboxWrapper.contains(e.target)) {
      togglePopover(false);
    }
  };
  document.addEventListener('click', onDocClick);

  // 快速時間選擇按鈕 (+15分, +30分, +1小時, 現在)
  const quickBtns = formCard.querySelectorAll('.btn-quick-time');
  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const offsetMins = parseInt(btn.dataset.offset, 10);
      const targetDate = new Date();
      if (offsetMins > 0) {
        targetDate.setMinutes(targetDate.getMinutes() + offsetMins);
      }
      const hStr = targetDate.getHours().toString().padStart(2, '0');
      const mStr = targetDate.getMinutes().toString().padStart(2, '0');
      hourSelect.value = hStr;
      minSelect.value = mStr;
      hourSelect.dispatchEvent(new Event('change'));
      minSelect.dispatchEvent(new Event('change'));
      timeInput.value = `${hStr}:${mStr}`;
      updateTimeRestrictions(false);
      togglePopover(false);
    });
  });

  function updateTimeRestrictions(skipTimeInputSync = false) {
    const currentNow = getNowLocal();
    const checkedRadio = formCard.querySelector('.inline-type-radio:checked');
    const selectedType = checkedRadio ? checkedRadio.value : 'once';
    const isDateMode = selectedType === 'date';

    dateInput.min = currentNow.todayStr;
    if (isDateMode && dateInput.value && dateInput.value < currentNow.todayStr) {
      dateInput.value = currentNow.todayStr;
    }

    const includesToday = selectedDates.length > 0
      ? selectedDates.includes(currentNow.todayStr)
      : (dateInput.value === currentNow.todayStr);
    const isToday = isDateMode && includesToday;
    const curHInt = parseInt(currentNow.currentH, 10);
    const curMInt = parseInt(currentNow.currentM, 10);

    Array.from(hourSelect.options).forEach(opt => {
      const hVal = parseInt(opt.value, 10);
      opt.disabled = isToday && (hVal < curHInt);
    });

    if (isToday && parseInt(hourSelect.value, 10) < curHInt) {
      hourSelect.value = currentNow.currentH;
    }

    const selectedHInt = parseInt(hourSelect.value, 10);
    Array.from(minSelect.options).forEach(opt => {
      const mVal = parseInt(opt.value, 10);
      opt.disabled = isToday && (selectedHInt === curHInt) && (mVal < curMInt);
    });

    if (isToday && (selectedHInt === curHInt) && parseInt(minSelect.value, 10) < curMInt) {
      minSelect.value = currentNow.currentM;
    }

    if (!skipTimeInputSync) {
      timeInput.value = `${hourSelect.value}:${minSelect.value}`;
    }

    if (timeWheelPicker) {
      timeWheelPicker.updateRestrictions(isToday, curHInt, curMInt, selectedHInt);
    }
    updateOnceHint();
  }

  renderSelectedDates();
  // 套用初始時間限制
  updateTimeRestrictions(false);

  const radios = formCard.querySelectorAll('.inline-type-radio');
  const onceGroup = formCard.querySelector('.inline-once-group');
  const dateGroup = formCard.querySelector('.inline-date-group');
  const weeklyGroup = formCard.querySelector('.inline-weekly-group');

  function syncTypeGroups(typeVal) {
    onceGroup.style.display = typeVal === 'once' ? 'block' : 'none';
    weeklyGroup.style.display = typeVal === 'weekly' ? 'block' : 'none';
    dateGroup.style.display = typeVal === 'date' ? 'block' : 'none';
    updateTimeRestrictions(false);
  }

  radios.forEach(r => r.addEventListener('change', () => {
    if (!r.checked) return;
    syncTypeGroups(r.value);
  }));

  dateInput.addEventListener('change', () => {
    if (dateInput.value) {
      addDateToSelection(dateInput.value, { silentDuplicate: true });
    } else {
      updateTimeRestrictions(false);
    }
  });

  btnAddDate.addEventListener('click', (e) => {
    e.stopPropagation();
    addDateToSelection(dateInput.value, { silentDuplicate: false });
  });

  quickDateBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const offset = parseInt(btn.dataset.offsetDays, 10) || 0;
      const targetStr = addDaysLocal(offset);
      if (selectedDates.includes(targetStr)) {
        selectedDates = selectedDates.filter(d => d !== targetStr);
        renderSelectedDates();
        updateTimeRestrictions(false);
      } else {
        dateInput.value = targetStr;
        addDateToSelection(targetStr, { silentDuplicate: true });
      }
    });
  });

  hourSelect.addEventListener('change', () => {
    updateTimeRestrictions(false);
  });

  minSelect.addEventListener('change', () => {
    timeInput.value = `${hourSelect.value}:${minSelect.value}`;
    updateOnceHint();
  });

  // 需求 3：手動輸入時間即時連動
  timeInput.addEventListener('input', () => {
    const parsed = parseTimeString(timeInput.value);
    if (parsed) {
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
      updateTimeRestrictions(true);
    }
  });

  timeInput.addEventListener('blur', () => {
    const parsed = parseTimeString(timeInput.value);
    if (parsed) {
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
      updateTimeRestrictions(false);
      if (timeWheelPicker) {
        timeWheelPicker.syncToCurrent(true);
      }
    } else {
      timeInput.value = `${hourSelect.value}:${minSelect.value}`;
    }
  });

  timeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formCard.querySelector('.btn-confirm').click();
    }
  });

  formCard.querySelector('.btn-confirm').onclick = () => {
    const selectedType = formCard.querySelector('.inline-type-radio:checked').value;
    const parsed = parseTimeString(timeInput.value);
    let time = `${hourSelect.value}:${minSelect.value}`;
    if (parsed) {
      time = parsed.formatted;
      hourSelect.value = parsed.h;
      minSelect.value = parsed.m;
    } else {
      showError('請輸入正確的時間格式（例如 08:30）！');
      return;
    }

    const msg = formCard.querySelector('.inline-msg-input').value.trim();
    const snooze = parseInt(formCard.querySelector('.inline-snooze-input').value, 10) || 5;
    const currentNow = getNowLocal();

    let days = [];
    let finalDates = [];
    let finalDate = '';
    let targetDate = '';

    if (selectedType === 'once') {
      targetDate = computeOnceTargetDate(time, currentNow);
    } else if (selectedType === 'weekly') {
      formCard.querySelectorAll('.inline-day-cb').forEach(cb => {
        if (cb.checked) days.push(parseInt(cb.value, 10));
      });
      if (days.length === 0) {
        showError('每週重複模式必須至少選擇一天！');
        return;
      }
    } else {
      finalDates = selectedDates.length > 0
        ? [...selectedDates]
        : (dateInput.value ? [dateInput.value] : []);
      if (finalDates.length === 0) {
        showError('請至少選擇一個特定日期！');
        return;
      }

      // 需求 4 檢核：不可選擇過去日期或當日過去時間
      if (finalDates.some(d => d < currentNow.todayStr)) {
        showError('特定日期不能選擇過去的日期！');
        return;
      }
      if (finalDates.includes(currentNow.todayStr) && time < currentNow.currentTimeStr) {
        showError('特定日期包含今天時，鬧鐘時間不能早於當下時間！');
        return;
      }
      finalDates = [...new Set(finalDates)].sort();
      finalDate = finalDates[0];
    }

    if (!msg) {
      showError('請輸入提醒內容！');
      return;
    }

    document.removeEventListener('click', onDocClick);
    if (timeWheelPicker) {
      timeWheelPicker.destroy();
    }
    onSave({
      type: selectedType,
      time: time,
      targetDate: targetDate,
      date: finalDate,
      dates: finalDates,
      days: days,
      message: msg,
      snoozeInterval: snooze
    });
  };

  const msgInputEl = formCard.querySelector('.inline-msg-input');
  msgInputEl.onmousedown = (e) => {
    e.stopPropagation();
  };
  msgInputEl.onclick = () => {
    msgInputEl.focus();
  };
  msgInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formCard.querySelector('.btn-confirm').click();
    }
  });

  formCard.querySelector('.btn-cancel').onclick = () => {
    document.removeEventListener('click', onDocClick);
    if (timeWheelPicker) {
      timeWheelPicker.destroy();
    }
    onCancel();
  };

  setTimeout(() => {
    window.focus();
    msgInputEl.focus();
  }, 50);

  return formCard;
}

function renderAlarms() {
  alarmList.innerHTML = '';

  if (isCreatingDraft) {
    const draftForm = createAlarmInlineForm(null, true, (newAlarmData) => {
      const newAlarm = {
        id: crypto.randomUUID(),
        enabled: true,
        ...newAlarmData
      };
      alarms.push(newAlarm);
      saveAlarms();
      isCreatingDraft = false;
      notifyAlarmEnabled(newAlarm);
      loadAlarms();
    }, () => {
      isCreatingDraft = false;
      renderAlarms();
    });
    alarmList.appendChild(draftForm);
  }
  
  if (alarms.length === 0 && !isCreatingDraft) {
    alarmList.innerHTML = '<div class="empty-state">還沒有設定任何提醒喔！<br>點擊右上角「➕ 新增」建立第一個提醒吧！</div>';
    return;
  }

  alarms.forEach(alarm => {
    if (activeEditId === alarm.id) {
      const editForm = createAlarmInlineForm(alarm, false, (updatedData) => {
        Object.assign(alarm, updatedData);
        saveAlarms();
        activeEditId = null;
        if (alarm.enabled) {
          notifyAlarmEnabled(alarm);
        }
        loadAlarms();
      }, () => {
        activeEditId = null;
        renderAlarms();
      });
      alarmList.appendChild(editForm);
      return;
    }

    const item = document.createElement('div');
    item.className = 'alarm-item' + (alarm.enabled ? '' : ' disabled');
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'alarm-time';
    timeDiv.textContent = alarm.time;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'alarm-msg';
    
    let typeText = '';
    let typeTitle = '';
    if (alarm.type === 'once') {
      const currentNow = getNowLocal();
      if (alarm.enabled && alarm.targetDate) {
        if (alarm.targetDate === currentNow.todayStr) {
          typeText = '⚡ 一次性（今天）';
        } else if (alarm.targetDate === currentNow.tomorrowStr) {
          typeText = '⚡ 一次性（明天）';
        } else {
          typeText = `⚡ 一次性（${alarm.targetDate}）`;
        }
        typeTitle = `預計提醒日期：${alarm.targetDate}`;
      } else {
        typeText = '⚡ 一次性';
      }
    } else if (alarm.type === 'date') {
      const datesList = normalizeAlarmDates(alarm);
      if (datesList.length <= 1) {
        typeText = `📅 ${datesList[0] || alarm.date || ''}`;
      } else if (datesList.length === 2) {
        typeText = `📅 ${datesList[0]}、${datesList[1].slice(5)}`;
        typeTitle = datesList.join('、');
      } else {
        typeText = `📅 ${datesList[0]} 等 ${datesList.length} 天`;
        typeTitle = datesList.join('、');
      }
    } else {
      const alarmDays = Array.isArray(alarm.days) ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
      if (alarmDays.length === 7) {
        typeText = '🔁 每天';
      } else {
        const dayMap = ['日','一','二','三','四','五','六'];
        typeText = '🔁 每週 ' + alarmDays.map(d => dayMap[d]).join(', ');
      }
    }
    
    let linkedTodoHtml = '';
    let linkedTodo = todos.find(t => (t.linkedAlarmId && t.linkedAlarmId === alarm.id) || (alarm.linkedTodoId && alarm.linkedTodoId === t.id));
    if (!linkedTodo) {
      linkedTodo = todos.find(t => alarm.message === t.text || alarm.message === `📋 待辦提醒：${t.text}`);
    }

    if (linkedTodo) {
      linkedTodoHtml = `<button class="linked-badge todo-link-btn" title="點擊前往待辦事項視窗" onclick="ipcRenderer.send('open-todo')">🔗</button>`;
    }

    const displayMsg = alarm.message.replace(/^📋 待辦提醒：/, '');

    msgDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #00796b; font-weight: bold;">
        <span${typeTitle ? ` title="${typeTitle}"` : ''}>${typeText}</span>
        ${linkedTodoHtml}
      </div>
      <div style="font-size: 13px; color: var(--theme-text-body); margin-top: 3px; line-height: 1.3;">${displayMsg}</div>
      <div style="font-size: 11px; color: #888; margin-top: 2px;">(貪睡: ${alarm.snoozeInterval || 5} 分鐘)</div>
    `;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'alarm-actions';
    
    // 需求 1：開關改為 switch 按鈕
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    switchLabel.title = alarm.enabled ? '點擊停用鬧鐘' : '點擊啟用鬧鐘';

    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.className = 'alarm-switch-input';
    switchInput.checked = !!alarm.enabled;

    const switchSlider = document.createElement('span');
    switchSlider.className = 'slider';

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(switchSlider);

    switchInput.onchange = () => {
      const willEnable = switchInput.checked;
      if (willEnable) {
        const currentNow = getNowLocal();
        if (alarm.type === 'once') {
          alarm.targetDate = computeOnceTargetDate(alarm.time, currentNow);
        } else if (alarm.type === 'date') {
          // 若特定日期皆為過去時間，自動更新為當下時間；若部分已過期則僅保留未來日期
          const datesList = normalizeAlarmDates(alarm);
          const upcomingDates = datesList.filter(
            d => d > currentNow.todayStr || (d === currentNow.todayStr && alarm.time >= currentNow.currentTimeStr)
          );
          if (upcomingDates.length === 0) {
            alarm.dates = [currentNow.todayStr];
            alarm.date = currentNow.todayStr;
            alarm.time = currentNow.currentTimeStr;
          } else {
            alarm.dates = upcomingDates;
            alarm.date = upcomingDates[0];
          }
        }
        alarm.enabled = true;
        saveAlarms();
        // 需求 2：鬧鐘啟用時通報
        notifyAlarmEnabled(alarm);
      } else {
        alarm.enabled = false;
        saveAlarms();
      }
      renderAlarms();
    };
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '✏️';
    editBtn.title = '編輯';
    editBtn.onclick = () => {
      activeEditId = alarm.id;
      isCreatingDraft = false;
      renderAlarms();
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '<i class="theme-icon icon-trash"></i>';
    deleteBtn.title = '刪除';
    deleteBtn.onclick = () => {
      actionsDiv.innerHTML = `
        <span style="font-size:11px; color:#e53935; font-weight:bold;">確定刪除？</span>
        <button class="btn-confirm-del" style="padding:3px 8px; background:#e53935; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:11px; font-weight:bold;">刪除</button>
        <button class="btn-cancel-del" style="padding:3px 8px; background:#eee; border:none; border-radius:8px; cursor:pointer; font-size:11px;">取消</button>
      `;
      actionsDiv.querySelector('.btn-confirm-del').onclick = () => {
        alarms = alarms.filter(a => a.id !== alarm.id);
        if (activeEditId === alarm.id) activeEditId = null;
        saveAlarms();
        renderAlarms();
      };
      actionsDiv.querySelector('.btn-cancel-del').onclick = () => {
        renderAlarms();
      };
    };
    
    actionsDiv.appendChild(switchLabel);
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    item.appendChild(timeDiv);
    item.appendChild(msgDiv);
    item.appendChild(actionsDiv);
    
    alarmList.appendChild(item);
  });
}

btnOpenAdd.onclick = () => {
  isCreatingDraft = true;
  activeEditId = null;
  renderAlarms();
  window.focus();
};

loadAlarms();
