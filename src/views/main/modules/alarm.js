const fs = require('fs');

let snoozedAlarms = [];
let triggeredAlarms = {};

function init({
  alarmsPath, laser, resetIdle, showAlarmBubble, kiwi, ipcRenderer
}) {
  function triggerAlarm(alarm, alarmKey) {
    if (!triggeredAlarms[alarmKey]) {
      triggeredAlarms[alarmKey] = true;
      if (laser.getIsLaserGameActive()) {
        laser.toggleLaserGame(false);
      }
      resetIdle();
      showAlarmBubble(alarm, (alarmToSnooze, snoozeMins) => {
        // onSnooze callback
        const triggerTime = Date.now() + snoozeMins * 60000;
        snoozedAlarms.push({ ...alarmToSnooze, triggerTime });
      });
      kiwi.classList.add('jumping');
      setTimeout(() => { kiwi.classList.remove('jumping'); }, 500);
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
        triggerAlarm(sAlarm, sAlarm.id + '-snooze-' + nowMs);
      }
    }

    if (fs.existsSync(alarmsPath)) {
      try {
        const data = fs.readFileSync(alarmsPath, 'utf8');
        const alarms = JSON.parse(data);
        const now = new Date();
        alarms.forEach(alarm => {
          if (!alarm.enabled) return;

          const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
          if (alarm.time !== currentHHMM) return;

          let shouldTrigger = false;
          if (alarm.type === 'date') {
            const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            if (alarm.date === todayStr) {
              shouldTrigger = true;
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

            if (alarm.type === 'date') {
              alarm.enabled = false;
              try {
                fs.writeFileSync(alarmsPath, JSON.stringify(alarms, null, 2), 'utf8');
                ipcRenderer.send('reload-data');
              } catch (e) { }
            }
          }
        });
      } catch (e) {
        console.error('Failed to parse alarms:', e);
      }
    }
  }, 5000);
}

module.exports = { init };
