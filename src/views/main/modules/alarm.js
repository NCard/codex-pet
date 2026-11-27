const fs = require('fs');

let snoozedAlarms = [];
let triggeredAlarms = {};

function formatLocalDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAlarmDates(alarm) {
  if (Array.isArray(alarm.dates) && alarm.dates.length > 0) {
    return Array.from(new Set(alarm.dates.filter(d => typeof d === 'string' && d.trim()))).sort();
  }
  if (typeof alarm.date === 'string' && alarm.date.trim()) {
    return [alarm.date.trim()];
  }
  return [];
}

function init({
  alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer, alarmStalker, triggerWalk, _walkToCorner, setSnoozing
}) {
  snoozedAlarms = [];
  triggeredAlarms = {};

  function triggerAlarm(alarm, alarmKey) {
    if (!triggeredAlarms[alarmKey]) {
      triggeredAlarms[alarmKey] = true;
      if (laser.getIsLaserGameActive()) {
        laser.toggleLaserGame(false);
      }
      resetIdle();
      showAlarmBubble(
        alarm,
        (alarmToSnooze, snoozeMins) => {
          // onSnooze callback
          const triggerTime = Date.now() + snoozeMins * 60000;
          snoozedAlarms.push({ ...alarmToSnooze, triggerTime });
        },
        (dismissReason) => {
          // onDismiss callback
          if (alarmStalker && typeof alarmStalker.stopStalking === 'function') {
            alarmStalker.stopStalking(dismissReason);
          } else if ((dismissReason === 'ok' || dismissReason === 'snooze') && typeof triggerWalk === 'function') {
            setTimeout(() => { triggerWalk(); }, 500);
          }
        }
      );

      if (alarmStalker && typeof alarmStalker.startStalking === 'function') {
        alarmStalker.startStalking(alarm);
      } else {
        kiwi.classList.add('jumping');
        setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
      }
    }
  }

  // 檢查貪睡清單與一般鬧鐘
  setInterval(() => {
    const nowMs = Date.now();
    // 檢查貪睡清單
    for (let i = snoozedAlarms.length - 1; i >= 0; i--) {
      const sAlarm = snoozedAlarms[i];
      if (nowMs >= sAlarm.triggerTime) {
        snoozedAlarms.splice(i, 1);
        if (typeof setSnoozing === 'function') {
          setSnoozing(false);
        }
        triggerAlarm(sAlarm, sAlarm.id + '-snooze-' + nowMs);
      }
    }

    if (fs.existsSync(alarmsPath)) {
      try {
        const data = fs.readFileSync(alarmsPath, 'utf8');
        const alarms = JSON.parse(data);
        const now = new Date();
        const todayStr = formatLocalDate(now);
        const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        let shouldPersist = false;

        alarms.forEach(alarm => {
          if (!alarm.enabled) return;
          if (alarm.time !== currentHHMM) return;

          let shouldTrigger = false;
          let disableAfterTrigger = false;

          if (alarm.type === 'once') {
            if (!alarm.targetDate || todayStr >= alarm.targetDate) {
              shouldTrigger = true;
              disableAfterTrigger = true;
            }
          } else if (alarm.type === 'date') {
            const targetDates = getAlarmDates(alarm);
            if (targetDates.includes(todayStr)) {
              shouldTrigger = true;
              const hasRemainingFutureDates = targetDates.some(d => d > todayStr);
              disableAfterTrigger = !hasRemainingFutureDates;
            }
          } else {
            // weekly or legacy
            const currentDay = now.getDay();
            if (!alarm.days || alarm.days.includes(currentDay)) {
              shouldTrigger = true;
            }
          }

          if (shouldTrigger) {
            const alarmKey = alarm.id + '-' + now.toDateString() + '-' + currentHHMM;
            triggerAlarm(alarm, alarmKey);

            if (disableAfterTrigger) {
              alarm.enabled = false;
              shouldPersist = true;
            }
          }
        });

        if (shouldPersist) {
          try {
            fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
            ipcRenderer.send('reload-data');
          } catch { /* ignore persist error */ }
        }
      } catch (e) {
        console.error('Failed to parse alarms:', e);
      }
    }
  }, 5000);
}

module.exports = { init };
