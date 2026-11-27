const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatLocalDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayStr() {
  return formatLocalDate(new Date());
}

function addDaysFromToday(offsetDays) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return formatLocalDate(target);
}

function parseDateParts(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatDateChipLabel(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const d = new Date(parts.year, parts.month, parts.day);
  return `${dateStr} (${DAY_NAMES[d.getDay()]})`;
}

function normalizeDatesArray(dates) {
  if (!Array.isArray(dates)) return [];
  const valid = new Set(
    dates
      .map(d => (typeof d === 'string' ? d.trim() : ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );
  return Array.from(valid).sort();
}

/**
 * 掛載 Android 風格內嵌多選日曆元件
 * @param {HTMLElement} containerEl 容器元素
 * @param {Object} options 設定項
 */
function mountMultiDateCalendar(containerEl, options = {}) {
  let minDate = options.minDate || getTodayStr();
  let selectedDates = normalizeDatesArray(options.initialDates || []);
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
  const onInvalidDate = typeof options.onInvalidDate === 'function' ? options.onInvalidDate : () => {};
  const showQuickButtons = options.showQuickButtons !== false;
  const compact = Boolean(options.compact);

  // 初始顯示月份：優先顯示第一個已選日期所在月份，否則顯示本月
  const initAnchor = parseDateParts(selectedDates[0] || minDate) || parseDateParts(getTodayStr());
  let viewYear = initAnchor.year;
  let viewMonth = initAnchor.month; // 0-11

  containerEl.innerHTML = `
    <input type="date" class="inline-date-input calendar-hidden-date-input" min="${minDate}" value="${selectedDates[0] || minDate}" tabindex="-1" aria-hidden="true">
    <div class="multi-calendar-widget${compact ? ' is-compact' : ''}">
      <div class="multi-calendar-header">
        <button type="button" class="cal-nav-btn cal-prev-month" title="上個月" aria-label="上個月">‹</button>
        <button type="button" class="cal-month-title" title="回到本月"></button>
        <button type="button" class="cal-nav-btn cal-next-month" title="下個月" aria-label="下個月">›</button>
      </div>
      <div class="multi-calendar-weekdays">
        ${DAY_NAMES.map((name, idx) => `<span class="cal-weekday${idx === 0 || idx === 6 ? ' is-weekend' : ''}">${name}</span>`).join('')}
      </div>
      <div class="multi-calendar-grid"></div>
      ${showQuickButtons ? `
        <div class="multi-calendar-footer">
          <div class="date-quick-group">
            <button type="button" class="btn-quick-date" data-offset-days="0">今天</button>
            <button type="button" class="btn-quick-date" data-offset-days="1">明天</button>
            <button type="button" class="btn-quick-date" data-offset-days="2">後天</button>
          </div>
          <div class="date-footer-right">
            <span class="date-count-hint"></span>
            <button type="button" class="btn-clear-dates" style="display: none;" title="清除已選日期">清除</button>
          </div>
        </div>
      ` : ''}
      <div class="selected-dates-list"></div>
    </div>
  `;

  const dateInput = containerEl.querySelector('.inline-date-input');
  const prevBtn = containerEl.querySelector('.cal-prev-month');
  const nextBtn = containerEl.querySelector('.cal-next-month');
  const monthTitleBtn = containerEl.querySelector('.cal-month-title');
  const gridEl = containerEl.querySelector('.multi-calendar-grid');
  const quickBtns = containerEl.querySelectorAll('.btn-quick-date');
  const countHintEl = containerEl.querySelector('.date-count-hint');
  const clearBtn = containerEl.querySelector('.btn-clear-dates');
  const chipsListEl = containerEl.querySelector('.selected-dates-list');

  function syncHiddenDateInput() {
    dateInput.min = minDate;
    dateInput.value = selectedDates[0] || minDate;
  }

  function emitChange() {
    syncHiddenDateInput();
    onChange([...selectedDates]);
  }

  function renderCalendar() {
    const todayStr = getTodayStr();
    const minParts = parseDateParts(minDate) || parseDateParts(todayStr);

    monthTitleBtn.textContent = `${viewYear} 年 ${viewMonth + 1} 月`;

    // 若目前已在最小可選月份，停用上個月按鈕
    const isAtMinMonth = (viewYear < minParts.year) || (viewYear === minParts.year && viewMonth <= minParts.month);
    prevBtn.disabled = isAtMinMonth;

    // 建置當月日期網格
    gridEl.innerHTML = '';
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayOfWeek; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'cal-day-spacer';
      gridEl.appendChild(spacer);
    }

    const selectedSet = new Set(selectedDates);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${(viewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dow = (firstDayOfWeek + day - 1) % 7;
      const isPast = dateStr < minDate;
      const isToday = dateStr === todayStr;
      const isSelected = selectedSet.has(dateStr);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-btn';
      btn.dataset.date = dateStr;
      btn.textContent = String(day);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      if (dow === 0 || dow === 6) btn.classList.add('is-weekend');
      if (isToday) btn.classList.add('is-today');
      if (isPast) {
        btn.classList.add('is-past');
        btn.disabled = true;
      }
      if (isSelected) {
        btn.classList.add('is-selected');
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDate(dateStr);
      });

      gridEl.appendChild(btn);
    }

    // 更新快速按鈕狀態與計數
    quickBtns.forEach(btn => {
      const offset = parseInt(btn.dataset.offsetDays, 10) || 0;
      const targetStr = addDaysFromToday(offset);
      btn.classList.toggle('active', selectedSet.has(targetStr));
    });

    if (countHintEl) {
      countHintEl.textContent = selectedDates.length > 0 ? `已選 ${selectedDates.length} 天` : '點擊日期可多選';
    }
    if (clearBtn) {
      clearBtn.style.display = selectedDates.length > 0 ? 'inline-block' : 'none';
    }

    // 渲染已選日期標籤列（跨月也一目了然）
    chipsListEl.innerHTML = '';
    if (selectedDates.length === 0) {
      const emptyEl = document.createElement('span');
      emptyEl.className = 'selected-dates-empty';
      emptyEl.textContent = '直接在上方日曆點選多個日期（再點一次可取消）';
      chipsListEl.appendChild(emptyEl);
    } else {
      selectedDates.forEach(d => {
        const chip = document.createElement('span');
        chip.className = 'date-tag-chip';
        chip.dataset.date = d;

        const labelBtn = document.createElement('button');
        labelBtn.type = 'button';
        labelBtn.className = 'date-tag-jump';
        labelBtn.title = `跳至 ${d} 所在月份`;
        labelBtn.textContent = formatDateChipLabel(d);
        labelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const parts = parseDateParts(d);
          if (parts) {
            viewYear = parts.year;
            viewMonth = parts.month;
            renderCalendar();
          }
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'date-tag-remove';
        removeBtn.dataset.date = d;
        removeBtn.title = `移除 ${d}`;
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedDates = selectedDates.filter(item => item !== d);
          renderCalendar();
          emitChange();
        });

        chip.appendChild(labelBtn);
        chip.appendChild(removeBtn);
        chipsListEl.appendChild(chip);
      });
    }

    syncHiddenDateInput();
  }

  function addDate(dateStr) {
    const parts = parseDateParts(dateStr);
    if (!parts) return false;
    if (dateStr < minDate) {
      onInvalidDate('特定日期不能選擇過去的日期！');
      return false;
    }
    if (!selectedDates.includes(dateStr)) {
      selectedDates = [...selectedDates, dateStr].sort();
    }
    viewYear = parts.year;
    viewMonth = parts.month;
    renderCalendar();
    emitChange();
    return true;
  }

  function toggleDate(dateStr) {
    const parts = parseDateParts(dateStr);
    if (!parts) return false;
    if (dateStr < minDate) {
      onInvalidDate('特定日期不能選擇過去的日期！');
      return false;
    }
    if (selectedDates.includes(dateStr)) {
      selectedDates = selectedDates.filter(d => d !== dateStr);
    } else {
      selectedDates = [...selectedDates, dateStr].sort();
    }
    renderCalendar();
    emitChange();
    return true;
  }

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (prevBtn.disabled) return;
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });

  monthTitleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowParts = parseDateParts(getTodayStr());
    viewYear = nowParts.year;
    viewMonth = nowParts.month;
    renderCalendar();
  });

  quickBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const offset = parseInt(btn.dataset.offsetDays, 10) || 0;
      const targetStr = addDaysFromToday(offset);
      const parts = parseDateParts(targetStr);
      if (parts) {
        viewYear = parts.year;
        viewMonth = parts.month;
      }
      toggleDate(targetStr);
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedDates = [];
      renderCalendar();
      emitChange();
    });
  }

  // 保持隱藏 date input 雙向相容
  dateInput.addEventListener('change', () => {
    if (dateInput.value) {
      addDate(dateInput.value);
    }
  });

  renderCalendar();

  return {
    getDates: () => [...selectedDates],
    setDates: (nextDates) => {
      selectedDates = normalizeDatesArray(nextDates);
      const firstParts = parseDateParts(selectedDates[0]);
      if (firstParts) {
        viewYear = firstParts.year;
        viewMonth = firstParts.month;
      }
      renderCalendar();
      syncHiddenDateInput();
    },
    addDate,
    toggleDate,
    setMinDate: (nextMinDate) => {
      if (nextMinDate && nextMinDate !== minDate) {
        minDate = nextMinDate;
        renderCalendar();
      }
    },
    goToMonth: (year, monthIndex) => {
      viewYear = year;
      viewMonth = monthIndex;
      renderCalendar();
    },
    getDateInput: () => dateInput
  };
}

module.exports = {
  mountMultiDateCalendar,
  formatLocalDate,
  formatDateChipLabel,
  normalizeDatesArray
};
