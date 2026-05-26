/**
 * 第17小隊親證定課打卡系統 - 核心控制邏輯
 */

// 應用程式狀態機
const state = {
  currentUser: null,       // 當前使用者資料物體
  activeDate: "2026-05-01",// 當前選中的打卡西曆日期 YYYY-MM-DD
  checkInHistory: {},      // 打卡歷史資料庫 (存儲於 LocalStorage)
  customTasks: [],         // 使用者自訂每日任務清單
  modalMonth: 5,           // 月曆 Modal 的月份 (5, 6, 7, 8)
  modalYear: 2026          // 月曆 Modal 的年份
};

// 選擇 DOM 元素
const onboardingEl = document.getElementById("onboarding");
const onboardingUserGridEl = document.getElementById("onboardingUserGrid");
const mainLayoutEl = document.getElementById("mainLayout");
const switchProfileBtn = document.getElementById("switchProfileBtn");

const headerAvatarEl = document.getElementById("headerAvatar");
const headerUserNameEl = document.getElementById("headerUserName");
const headerUserRoleEl = document.getElementById("headerUserRole");

const weekStripEl = document.getElementById("weekStrip");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");

const activeSolarDateEl = document.getElementById("activeSolarDate");
const activeLunarDateEl = document.getElementById("activeLunarDate");
const specialDateBannerEl = document.getElementById("specialDateBanner");
const specialDateTextEl = document.getElementById("specialDateText");

const progressPercentTextEl = document.getElementById("progressPercentText");
const progressBarInnerEl = document.getElementById("progressBarInner");
const tasksChecklistEl = document.getElementById("tasksChecklist");

const copyLineBtn = document.getElementById("copyLineBtn");
const toastMessageEl = document.getElementById("toastMessage");

// 統計頁 DOM 元素
const statsCurrentStreakEl = document.getElementById("statsCurrentStreak");
const statsMaxStreakTextEl = document.getElementById("statsMaxStreakText");
const statsPenaltiesSavedEl = document.getElementById("statsPenaltiesSaved");
const statsCompletionRateEl = document.getElementById("statsCompletionRate");
const statsCheckedDaysCountEl = document.getElementById("statsCheckedDaysCount");
const statsRoleBadgeEl = document.getElementById("statsRoleBadge");
const statsCharNameEl = document.getElementById("statsCharName");
const statsRoleQuoteEl = document.getElementById("statsRoleQuote");
const statsHiddenTaskNameEl = document.getElementById("statsHiddenTaskName");

// 備份 DOM 元素
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importFileInputEl = document.getElementById("importFileInput");
const clearDataBtn = document.getElementById("clearDataBtn");

// 歷史月曆頁 DOM 元素
const historyMonthSelectEl = document.getElementById("historyMonthSelect");
const historyDaysGridEl = document.getElementById("historyDaysGrid");

// Modal DOM 元素
const calendarModalEl = document.getElementById("calendarModal");
const openCalendarModalBtn = document.getElementById("openCalendarModalBtn");
const closeCalendarModalBtn = document.getElementById("closeCalendarModalBtn");
const modalPrevMonthBtn = document.getElementById("modalPrevMonth");
const modalNextMonthBtn = document.getElementById("modalNextMonth");
const modalMonthTitleEl = document.getElementById("modalMonthTitle");
const modalDaysGridEl = document.getElementById("modalDaysGrid");

// 自訂任務 DOM 元素
const customTasksCountBadgeEl = document.getElementById("customTasksCountBadge");
const customTasksListEl = document.getElementById("customTasksList");
const addCustomTaskFormEl = document.getElementById("addCustomTaskForm");
const customTaskNameInputEl = document.getElementById("customTaskNameInput");
const customTaskModeSelectEl = document.getElementById("customTaskModeSelect");
const customTaskDateRangeGroupEl = document.getElementById("customTaskDateRangeGroup");
const customTaskStartInputEl = document.getElementById("customTaskStartInput");
const customTaskEndInputEl = document.getElementById("customTaskEndInput");
const cancelAddCustomTaskBtnEl = document.getElementById("cancelAddCustomTaskBtn");
const saveCustomTaskBtnEl = document.getElementById("saveCustomTaskBtn");
const showAddCustomTaskBtnEl = document.getElementById("showAddCustomTaskBtn");

// 初始化入口
window.addEventListener("DOMContentLoaded", () => {
  initApp();
});

// 初始化應用程式
function initApp() {
  // 1. 載入 LocalStorage 歷史紀錄
  loadHistoryFromStorage();
  
  // 2. 確定初始日期 (今天或行事曆第一天)
  setInitialDate();

  // 3. 檢查是否有已儲存的使用者
  let savedUserId = null;
  try {
    savedUserId = localStorage.getItem("17checkin_current_user");
  } catch (e) {
    console.warn("無法讀取 LocalStorage:", e);
  }

  if (savedUserId) {
    const user = MEMBER_DATA.find(u => u.id === savedUserId);
    if (user) {
      selectUser(user);
    } else {
      showOnboarding();
    }
  } else {
    showOnboarding();
  }

  // 4. 註冊 UI 事件監聽
  setupEventListeners();

  // 5. 註冊 PWA Service Worker 離線快取
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker 註冊成功！', reg.scope))
        .catch(err => console.log('Service Worker 註冊失敗：', err));
    });
  }
}

// 載入與處理 LocalStorage
function loadHistoryFromStorage() {
  try {
    const saved = localStorage.getItem("17checkin_history");
    if (saved) {
      state.checkInHistory = JSON.parse(saved);
    } else {
      state.checkInHistory = {};
    }
  } catch (e) {
    console.warn("讀取打卡歷史 LocalStorage 失敗:", e);
    state.checkInHistory = {};
  }
}

// 儲存資料到 LocalStorage
function saveHistoryToStorage() {
  try {
    localStorage.setItem("17checkin_history", JSON.stringify(state.checkInHistory));
  } catch (e) {
    console.warn("儲存打卡歷史 LocalStorage 失敗:", e);
  }
  // 打卡狀態變更時，立即重新整理當前畫面及統計
  updateProgressRing();
  renderWeekStrip();
  updateStatsDashboard();
  renderHistoryCalendarGrid();
}

// 設定起始日期 (若在 2026/06/01 至 2026/08/21 之間，使用今天日期；否則使用 2026-06-01)
function setInitialDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  // 檢查是否在我們行事曆的有效範圍內
  const inRange = CALENDAR_DATA.some(d => d.date === todayStr);
  if (inRange) {
    state.activeDate = todayStr;
  } else {
    // 預設為親證班第一天 (現在從 5/1 開始)
    state.activeDate = "2026-05-01";
  }
  
  // 設定 Modal 的初始年月
  const dateParts = state.activeDate.split("-");
  state.modalYear = parseInt(dateParts[0]);
  state.modalMonth = parseInt(dateParts[1]);
}

// 顯示 Onboarding 畫面
function showOnboarding() {
  onboardingEl.classList.remove("hidden");
  mainLayoutEl.classList.add("hidden");
  
  // 動態渲染 Onboarding 使用者選擇卡片
  onboardingUserGridEl.innerHTML = "";
  MEMBER_DATA.forEach(user => {
    const card = document.createElement("div");
    card.className = "user-select-card glass-panel";
    card.style.borderColor = `rgba(${hexToRgb(user.themeColor)}, 0.15)`;
    
    card.innerHTML = `
      <div class="card-avatar" style="background: linear-gradient(135deg, ${user.themeColor} 0%, rgba(${hexToRgb(user.themeColor)}, 0.6) 100%)">
        ${user.avatarChar}
      </div>
      <div class="card-name">${user.name}</div>
      <div class="card-role" style="color: ${user.themeColor}">${user.role} • ${user.character}</div>
    `;
    
    card.addEventListener("click", () => {
      selectUser(user);
    });
    onboardingUserGridEl.appendChild(card);
  });
}

// 選擇使用者身分
function selectUser(user) {
  state.currentUser = user;
  try {
    localStorage.setItem("17checkin_current_user", user.id);
  } catch (e) {
    console.warn("儲存使用者資料失敗:", e);
  }
  
  // 套用使用者專屬主題色 (CSS 變數)
  document.documentElement.style.setProperty('--primary-accent', user.themeColor);
  document.documentElement.style.setProperty('--primary-accent-glow', `rgba(${hexToRgb(user.themeColor)}, 0.35)`);
  
  // 更新 Header 資訊
  headerAvatarEl.textContent = user.avatarChar;
  headerAvatarEl.style.background = `linear-gradient(135deg, ${user.themeColor} 0%, rgba(${hexToRgb(user.themeColor)}, 0.6) 100%)`;
  headerUserNameEl.textContent = user.name;
  headerUserRoleEl.textContent = `${user.role} • ${user.character}`;
  
  // 隱藏 Onboarding，顯示主Layout
  onboardingEl.classList.add("hidden");
  mainLayoutEl.classList.remove("hidden");
  
  // 初始化渲染打卡主面板
  renderActiveDayPanel();
  renderWeekStrip();
  updateStatsDashboard();
  renderHistoryCalendarGrid();
}

// 註冊 UI 事件監聽
function setupEventListeners() {
  // 切換身分按鈕
  switchProfileBtn.addEventListener("click", () => {
    showOnboarding();
  });
  
  // 週切換導覽
  prevWeekBtn.addEventListener("click", () => shiftActiveDate(-7));
  nextWeekBtn.addEventListener("click", () => shiftActiveDate(7));
  
  // 底部分頁頁籤切換
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const tabId = item.getAttribute("data-tab");
      switchTab(tabId, item);
    });
  });
  
  // 一鍵複製 LINE 打卡文字
  copyLineBtn.addEventListener("click", generateAndCopyLineReport);
  
  // 歷史月曆選單變更
  historyMonthSelectEl.addEventListener("change", (e) => {
    renderHistoryCalendarGrid();
  });
  
  // Modal 月曆開啟與關閉
  openCalendarModalBtn.addEventListener("click", openCalendarModal);
  closeCalendarModalBtn.addEventListener("click", closeCalendarModal);
  calendarModalEl.addEventListener("click", (e) => {
    if (e.target === calendarModalEl) closeCalendarModal();
  });
  
  modalPrevMonthBtn.addEventListener("click", () => shiftModalMonth(-1));
  modalNextMonthBtn.addEventListener("click", () => shiftModalMonth(1));

  // 備份與還原功能
  exportDataBtn.addEventListener("click", exportUserData);
  importDataBtn.addEventListener("click", () => importFileInputEl.click());
  importFileInputEl.addEventListener("change", importUserData);
  clearDataBtn.addEventListener("click", resetUserData);

  // 5. 註冊自訂任務事件監聽
  setupCustomTasksListeners();

  // 6. 註冊報表子頁籤事件監聽
  const reportTabs = [
    { btn: "reportTabDailyBtn", panel: "reportDailyContent" },
    { btn: "reportTabWeeklyBtn", panel: "reportWeeklyContent" },
    { btn: "reportTabMonthlyBtn", panel: "reportMonthlyContent" }
  ];
  
  reportTabs.forEach(t => {
    const btnEl = document.getElementById(t.btn);
    if (btnEl) {
      btnEl.addEventListener("click", () => {
        reportTabs.forEach(ot => {
          document.getElementById(ot.btn).classList.remove("active");
          document.getElementById(ot.panel).style.display = "none";
        });
        btnEl.classList.add("active");
        document.getElementById(t.panel).style.display = "block";
        renderReports();
      });
    }
  });
}

// 切換分頁 Tabs
function switchTab(tabId, activeNavItem) {
  // 1. 切換分頁面板的可見度
  const tabPanels = document.querySelectorAll(".tab-panel");
  tabPanels.forEach(panel => {
    panel.classList.remove("active");
  });
  document.getElementById(tabId).classList.add("active");
  
  // 2. 切換底部按鈕的 active 狀態
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.classList.remove("active");
  });
  activeNavItem.classList.add("active");
  
  // 3. 切換分頁時重新更新數據，避免 LocalStorage 非同步顯示
  if (tabId === "tabStats") {
    updateStatsDashboard();
  } else if (tabId === "tabHistory") {
    // 預設將歷史月曆的選單跟當前選定的月份同步
    const activeMonth = parseInt(state.activeDate.split("-")[1]);
    historyMonthSelectEl.value = String(activeMonth);
    renderHistoryCalendarGrid();
  } else if (tabId === "tabCheckIn") {
    renderActiveDayPanel();
    renderWeekStrip();
  }
}

// 位移目前選中日期並重新渲染
function shiftActiveDate(days) {
  const current = new Date(state.activeDate);
  current.setDate(current.getDate() + days);
  
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  const newDateStr = `${y}-${m}-${d}`;
  
  // 檢查是否在 2026/06/01 至 2026/08/21 行事曆區間內
  const hasDate = CALENDAR_DATA.some(day => day.date === newDateStr);
  if (hasDate) {
    state.activeDate = newDateStr;
    renderActiveDayPanel();
    renderWeekStrip();
  } else {
    showToast("⚠️ 已超出親證班打卡行事曆區間！", "danger");
  }
}

// 渲染選定日期的詳細定課清單
function renderActiveDayPanel() {
  const activeDayData = CALENDAR_DATA.find(d => d.date === state.activeDate);
  if (!activeDayData) return;
  
  // 1. 設定日期與農曆抬頭
  const dateObj = new Date(state.activeDate);
  const weekdayStr = ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
  activeSolarDateEl.textContent = `${activeDayData.month}月${activeDayData.day}日 (${weekdayStr})`;
  
  let lunarStr = activeDayData.lunar ? `農曆${activeDayData.lunar}` : "";
  activeLunarDateEl.textContent = lunarStr;
  
  // 2. 處理特別 Banner 公告
  if (activeDayData.note) {
    specialDateBannerEl.classList.remove("hidden");
    specialDateTextEl.textContent = `特別提醒：${activeDayData.note}`;
  } else {
    specialDateBannerEl.classList.add("hidden");
  }
  
  // 3. 讀取當天已儲存的打卡歷史
  if (!state.checkInHistory[state.activeDate]) {
    state.checkInHistory[state.activeDate] = {};
  }
  const dayRecords = state.checkInHistory[state.activeDate];
  
  // 4. 動態渲染 Checkbox 任務清單
  tasksChecklistEl.innerHTML = "";
  
  activeDayData.tasks.forEach((task, idx) => {
    const card = document.createElement("div");
    card.className = "task-item-card glass-panel";
    
    // 依據任務字串分類：陰陽拳、五感恩/觀心書、角色隱藏任務、週任務、特別任務
    let isChecked = false;
    let taskKey = task; // LocalStorage 對應金鑰
    let isRoleTask = false;
    let isWeeklyTask = false;
    let displayTitle = task;
    let tagHtml = "";
    
    if (task.includes("陰陽拳")) {
      taskKey = "陰陽拳";
      isChecked = dayRecords[taskKey] || false;
      tagHtml = `<span class="task-tag" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5">🥊 沒打罰 $50</span>`;
    } else if (task.includes("五感恩") || task.includes("觀心書")) {
      taskKey = "五感恩_觀心書";
      isChecked = dayRecords[taskKey] || false;
      tagHtml = `<span class="task-tag" style="background: rgba(16, 185, 129, 0.15); color: #a7f3d0">📝 每日修行</span>`;
    } else if (task.includes("嗯啊吽") || task.includes("角色任務")) {
      taskKey = "角色任務";
      isRoleTask = true;
      isChecked = dayRecords[taskKey] || false;
      // 重點：動態替換為個人的專屬隱藏任務！
      displayTitle = state.currentUser.hiddenTask;
      tagHtml = `<span class="task-tag" style="background: linear-gradient(135deg, rgba(${hexToRgb(state.currentUser.themeColor)}, 0.25) 0%, rgba(${hexToRgb(state.currentUser.themeColor)}, 0.1) 100%); color: ${state.currentUser.themeColor}">🧘 ${state.currentUser.role}隱藏任務</span>`;
    } else if (task.includes("週任務")) {
      isWeeklyTask = true;
      isChecked = dayRecords[task] || false;
      tagHtml = `<span class="task-tag">📞 本週任務</span>`;
    } else {
      // 特別日子任務 (如：出席課後課、超越顛峰)
      isChecked = dayRecords[task] || false;
      tagHtml = `<span class="task-tag" style="background: rgba(245, 158, 11, 0.15); color: #fde047">⚡ 特別限定</span>`;
    }
    
    if (isChecked) {
      card.classList.add("checked");
    }
    
    // 如果是角色任務，另外上色左邊框
    if (isRoleTask) {
      card.classList.add("task-type-role");
      card.style.borderLeftColor = state.currentUser.themeColor;
    }
    if (isWeeklyTask) {
      card.classList.add("task-type-weekly");
    }
    
    card.innerHTML = `
      <input type="checkbox" class="task-checkbox-input" data-key="${taskKey}" data-raw="${task}" ${isChecked ? 'checked' : ''}>
      <div class="custom-chk"></div>
      <div class="task-content">
        <div class="task-title">${displayTitle}</div>
        ${tagHtml}
        ${
          taskKey === "五感恩_觀心書"
            ? `
            <div class="streak-input-row" id="streakInputRow" style="${isChecked ? '' : 'display:none;'}">
              <span>已連續打卡</span>
              <input type="number" class="streak-field" id="streakInputField" value="${dayRecords["五感恩_天數"] || 1}" min="1" onClick="event.stopPropagation();">
              <span>天</span>
            </div>
            `
            : ""
        }
        ${
          taskKey === "陰陽拳" && !isChecked
            ? `<div class="penalty-hint">⚠️ 今日漏打卡，需扣款罰金 $50 元！</div>`
            : taskKey === "陰陽拳" && isChecked
            ? `<div class="penalty-hint">🎉 恭喜！今天已省下罰金 $50 元。</div>`
            : ""
        }
      </div>
    `;
    
    // Checkbox 點擊打卡事件
    card.addEventListener("click", (e) => {
      // 避免點擊輸入框觸發整張卡片的切換
      if (e.target.id === "streakInputField") return;
      
      const chk = card.querySelector(".task-checkbox-input");
      const nextChecked = !chk.checked;
      chk.checked = nextChecked;
      
      // 更新狀態
      dayRecords[taskKey] = nextChecked;
      
      if (nextChecked) {
        card.classList.add("checked");
        // 觸發五感恩累計輸入框顯示
        if (taskKey === "五感恩_觀心書") {
          const row = card.querySelector("#streakInputRow");
          if (row) row.style.display = "";
          // 自動估算並填寫連續天數
          const estimatedStreak = estimateStreakForDate(state.activeDate);
          const inputField = card.querySelector("#streakInputField");
          if (inputField) {
            inputField.value = estimatedStreak;
            dayRecords["五感恩_天數"] = estimatedStreak;
          }
        }
      } else {
        card.classList.remove("checked");
        if (taskKey === "五感恩_觀心書") {
          const row = card.querySelector("#streakInputRow");
          if (row) row.style.display = "none";
        }
      }
      
      saveHistoryToStorage();
    });
    
    // 五感恩連續天數輸入框變更事件
    if (taskKey === "五感恩_觀心書") {
      const field = card.querySelector("#streakInputField");
      if (field) {
        field.addEventListener("change", (e) => {
          const val = parseInt(e.target.value) || 1;
          dayRecords["五感恩_天數"] = val;
          saveHistoryToStorage();
        });
      }
    }
    
    tasksChecklistEl.appendChild(card);
  });
  
  // 4.5 額外動態渲染使用者的「自訂每日任務」
  state.customTasks.forEach(task => {
    if (state.activeDate >= task.startDate && state.activeDate <= task.endDate) {
      const card = document.createElement("div");
      card.className = "task-item-card glass-panel";
      card.style.borderLeft = "4px solid var(--success)";
      
      const isChecked = dayRecords[task.id] || false;
      if (isChecked) {
        card.classList.add("checked");
      }
      
      card.innerHTML = `
        <input type="checkbox" class="task-checkbox-input" data-key="${task.id}" data-raw="${task.name}" ${isChecked ? 'checked' : ''}>
        <div class="custom-chk"></div>
        <div class="task-content">
          <div class="task-title">${task.name}</div>
          <span class="task-tag" style="background: rgba(16, 185, 129, 0.15); color: #34d399">🛠️ 自訂任務</span>
        </div>
      `;
      
      card.addEventListener("click", () => {
        const chk = card.querySelector(".task-checkbox-input");
        const nextChecked = !chk.checked;
        chk.checked = nextChecked;
        
        dayRecords[task.id] = nextChecked;
        if (nextChecked) {
          card.classList.add("checked");
        } else {
          card.classList.remove("checked");
        }
        saveHistoryToStorage();
      });
      
      tasksChecklistEl.appendChild(card);
    }
  });
  
  // 5. 更新進度環
  updateProgressRing();
}

// 自動估算某日期的五感恩連續天數
function estimateStreakForDate(dateStr) {
  // 尋找前一天的打卡紀錄
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prevDateStr = `${y}-${m}-${day}`;
  
  if (state.checkInHistory[prevDateStr] && state.checkInHistory[prevDateStr]["五感恩_觀心書"]) {
    const prevStreak = parseInt(state.checkInHistory[prevDateStr]["五感恩_天數"]) || 0;
    return prevStreak + 1;
  }
  return 1;
}

// 更新進度條與進度文字
function updateProgressRing() {
  const activeDayData = CALENDAR_DATA.find(d => d.date === state.activeDate);
  if (!activeDayData) return;
  
  const dayRecords = state.checkInHistory[state.activeDate] || {};
  let totalTasks = activeDayData.tasks.length;
  let checkedTasks = 0;
  
  activeDayData.tasks.forEach(task => {
    let taskKey = task;
    if (task.includes("陰陽拳")) taskKey = "陰陽拳";
    else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
    else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
    
    if (dayRecords[taskKey]) {
      checkedTasks++;
    }
  });

  // 加上自訂任務完成度的累加計算
  state.customTasks.forEach(task => {
    if (state.activeDate >= task.startDate && state.activeDate <= task.endDate) {
      totalTasks++;
      if (dayRecords[task.id]) {
        checkedTasks++;
      }
    }
  });
  
  const percent = totalTasks > 0 ? Math.round((checkedTasks / totalTasks) * 100) : 0;
  progressPercentTextEl.textContent = `${percent}%`;
  progressBarInnerEl.style.width = `${percent}%`;
  
  // 如果達到 100%，觸發 Confetti 動畫特效
  if (percent === 100 && !dayRecords["_confetti_played"]) {
    dayRecords["_confetti_played"] = true;
    triggerConfetti();
  } else if (percent < 100) {
    dayRecords["_confetti_played"] = false;
  }
}

// 觸發彩帶發光粒子效果 (Canvas-Confetti)
function triggerConfetti() {
  if (window.confetti) {
    window.confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: [state.currentUser.themeColor, '#ffffff', '#10b981', '#fbbf24']
    });
  }
}

// 渲染當前選中日期所在的 7 天週導覽條
function renderWeekStrip() {
  weekStripEl.innerHTML = "";
  
  // 1. 找出當前選中日期在行事曆中的索引
  const activeIdx = CALENDAR_DATA.findIndex(d => d.date === state.activeDate);
  if (activeIdx === -1) return;
  
  // 2. 計算這一週的起點與終點 (星期一為起始)
  const currentDayData = CALENDAR_DATA[activeIdx];
  const weekday = currentDayData.weekday; // 1=Mon, 7=Sun
  
  // 偏移量，用以找到這星期一在行事曆的 index
  const startIdx = activeIdx - (weekday - 1);
  
  // 3. 渲染 Mon 至 Sun 的 7 天按鈕
  for (let i = 0; i < 7; i++) {
    const dayIdx = startIdx + i;
    
    // 檢查是否超出整個行事曆的陣列範圍 (如行事曆剛好結束或剛好開始時)
    if (dayIdx < 0 || dayIdx >= CALENDAR_DATA.length) {
      // 渲染一個空白占位按鈕
      const placeholder = document.createElement("div");
      placeholder.className = "week-day-btn";
      placeholder.style.opacity = "0.2";
      placeholder.innerHTML = `<span class="day-num">-</span>`;
      weekStripEl.appendChild(placeholder);
      continue;
    }
    
    const dayData = CALENDAR_DATA[dayIdx];
    const isSelected = dayData.date === state.activeDate;
    
    const dateObj = new Date(dayData.date);
    const dayName = ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
    
    const btn = document.createElement("button");
    btn.className = "week-day-btn";
    if (isSelected) btn.classList.add("active");
    
    // 計算該天的打卡狀態點 (SUCCESS, PARTIAL, MISSED, EMPTY)
    const statusClass = getDayCheckInStatusClass(dayData.date);
    if (statusClass) {
      btn.classList.add(statusClass);
    }
    
    let displayLunar = dayData.lunar || "";
    // 如果有節氣或備註，導覽條只顯示 2 個字以防超出
    if (dayData.note) {
      const noteClean = dayData.note.split("/")[0].trim().substring(0, 2);
      displayLunar = noteClean;
    } else if (displayLunar.length > 2) {
      displayLunar = displayLunar.substring(0, 2);
    }
    
    btn.innerHTML = `
      <span class="day-name">週${dayName}</span>
      <span class="day-num">${dayData.day}</span>
      <span class="day-lunar">${displayLunar}</span>
      <span class="strip-dot"></span>
    `;
    
    btn.addEventListener("click", () => {
      state.activeDate = dayData.date;
      renderActiveDayPanel();
      renderWeekStrip();
    });
    
    weekStripEl.appendChild(btn);
  }
}

// 依據完成比例計算某一天的打卡狀態 class
function getDayCheckInStatusClass(dateStr) {
  const dayData = CALENDAR_DATA.find(d => d.date === dateStr);
  if (!dayData) return "";
  
  const records = state.checkInHistory[dateStr];
  if (!records) return "";
  
  // 計算完成度
  let total = dayData.tasks.length;
  let done = 0;
  
  if (total === 0) return "";
  
  dayData.tasks.forEach(task => {
    let taskKey = task;
    if (task.includes("陰陽拳")) taskKey = "陰陽拳";
    else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
    else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
    
    if (records[taskKey]) done++;
  });
  
  // 特殊判定：如果「陰陽拳」漏打(為 false)，一律視為有遺漏(MISSED)，因為這會罰 $50！
  if (dayData.tasks.some(t => t.includes("陰陽拳")) && records["陰陽拳"] === false) {
    return "dot-missed";
  }
  
  if (done === total) {
    return "dot-success";
  } else if (done > 0) {
    return "dot-partial";
  } else {
    // 若記錄中有些值為 false 但done=0
    const hasAnyRecord = Object.keys(records).length > 0;
    return hasAnyRecord ? "dot-missed" : "";
  }
}

// 一鍵複製 LINE 群組打卡回報格式文字
function generateAndCopyLineReport() {
  const activeDayData = CALENDAR_DATA.find(d => d.date === state.activeDate);
  if (!activeDayData) return;
  
  const dayRecords = state.checkInHistory[state.activeDate] || {};
  const dateParts = state.activeDate.split("-");
  const formattedDate = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
  
  // 計算目前省下罰款金額
  const stats = calculateStats();
  
  let report = `⚡ 第17小隊【${state.currentUser.name}】親證班打卡 ⚡\n`;
  report += `📅 日期：${formattedDate} (${getWeekdayName(state.activeDate)})\n`;
  if (activeDayData.lunar) report += `🌙 農曆：${activeDayData.lunar}\n`;
  if (activeDayData.note) report += `📢 今日焦點：${activeDayData.note}\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `🎯 每日定課任務：\n`;
  
  activeDayData.tasks.forEach(task => {
    let taskKey = task;
    let isChecked = false;
    let displayTitle = task;
    
    if (task.includes("陰陽拳")) {
      taskKey = "陰陽拳";
      isChecked = dayRecords[taskKey] || false;
      const statusIcon = isChecked ? "✅ 已完成" : "❌ 未完成 (累積罰金)";
      report += `【🥊 陰陽拳】${statusIcon} (今日省下 $50)\n`;
    } else if (task.includes("五感恩") || task.includes("觀心書")) {
      taskKey = "五感恩_觀心書";
      isChecked = dayRecords[taskKey] || false;
      const streakDays = dayRecords["五感恩_天數"] || 1;
      const statusIcon = isChecked ? `✅ 已完成 (連續第 ${streakDays} 天)` : "⏳ 進行中";
      report += `【📝 五感恩/觀心書】${statusIcon}\n`;
    } else if (task.includes("嗯啊吽") || task.includes("角色任務")) {
      taskKey = "角色任務";
      isChecked = dayRecords[taskKey] || false;
      displayTitle = state.currentUser.hiddenTask;
      const statusIcon = isChecked ? "✅ 已完成" : "⏳ 進行中";
      report += `【🧘 ${state.currentUser.role}任務 - ${displayTitle}】${statusIcon}\n`;
    } else {
      // 特別任務
      isChecked = dayRecords[task] || false;
      const statusIcon = isChecked ? "✅ 已完成" : "⏳ 進行中";
      report += `【⚡ ${task}】${statusIcon}\n`;
    }
  });

  // 加上自訂任務至 LINE 打卡報表
  state.customTasks.forEach(task => {
    if (state.activeDate >= task.startDate && state.activeDate <= task.endDate) {
      const isChecked = dayRecords[task.id] || false;
      const statusIcon = isChecked ? "✅ 已完成" : "⏳ 進行中";
      report += `【🛠️ 自訂 - ${task.name}】${statusIcon}\n`;
    }
  });
  
  report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `🔥 當前連續打卡：${stats.currentStreak} 天\n`;
  report += `💰 累計省下拳法罰金：$${stats.penaltiesSaved}\n`;
  report += `💪 越親證，越豐盛！加油！`;
  
  // 複製到剪貼簿 (支援行動裝置瀏覽器)
  copyTextToClipboard(report);
}

// 支援跨平台手機的剪貼簿複製
function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("📋 打卡文字複製成功！快去 LINE 群組貼上吧！", "success");
    }).catch(err => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";  // 避免滾動頁面
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "2em";
  textArea.style.height = "2em";
  textArea.style.padding = "0";
  textArea.style.border = "none";
  textArea.style.outline = "none";
  textArea.style.boxShadow = "none";
  textArea.style.background = "transparent";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast("📋 打卡文字複製成功！(備用模式)", "success");
    } else {
      showToast("❌ 複製失敗，請手動複製！", "danger");
    }
  } catch (err) {
    showToast("❌ 您的瀏覽器不支援一鍵複製！", "danger");
  }
  document.body.removeChild(textArea);
}

// 顯示 Toast 彈出小提示
function showToast(msg, type = "success") {
  toastMessageEl.textContent = msg;
  toastMessageEl.classList.remove("hidden");
  
  // 根據類別微調底色
  if (type === "danger") {
    toastMessageEl.style.backgroundColor = "rgba(239, 68, 68, 0.95)";
  } else {
    toastMessageEl.style.backgroundColor = "rgba(16, 185, 129, 0.95)";
  }
  
  setTimeout(() => {
    toastMessageEl.classList.add("hidden");
  }, 2500);
}

// 計算與更新統計頁儀表板
function updateStatsDashboard() {
  const stats = calculateStats();
  
  // 1. 更新數值卡片
  statsCurrentStreakEl.innerHTML = `${stats.roleTaskCheckedCount} <span class="stat-unit">次</span>`;
  statsMaxStreakTextEl.textContent = `連續最高: ${stats.maxStreak} 天`;
  statsPenaltiesSavedEl.textContent = `$${stats.penaltiesSaved}`;
  statsCompletionRateEl.textContent = `${stats.overallCompletionRate}%`;
  statsCheckedDaysCountEl.textContent = `累計打卡天數: ${stats.checkedDaysCount} 天`;
  
  // 2. 更新角色隱藏任務卡片
  statsRoleBadgeEl.textContent = state.currentUser.role;
  statsRoleBadgeEl.style.background = state.currentUser.themeColor;
  statsCharNameEl.textContent = `${state.currentUser.character} (${state.currentUser.name})`;
  statsRoleQuoteEl.textContent = `「${state.currentUser.tagline}」`;
  statsHiddenTaskNameEl.textContent = state.currentUser.hiddenTask;

  // 3. 觸發修行數據分析報表渲染
  renderReports();
}

// 統計數據核心計算引擎
function calculateStats() {
  let penaltiesSaved = 0;
  let checkedDaysCount = 0;
  let totalTasksAll = 0;
  let checkedTasksAll = 0;
  let roleTaskCheckedCount = 0;
  
  // 連續天數計算邏輯：追蹤五感恩每日打卡連續性
  let maxStreak = 0;
  let currentStreak = 0;
  
  // 將行事曆日期排序遍歷
  const allHistoryDates = Object.keys(state.checkInHistory).sort();
  
  // 計算累積省下金額 與 完成率
  CALENDAR_DATA.forEach(day => {
    const dateStr = day.date;
    const records = state.checkInHistory[dateStr];
    
    if (records) {
      let dayCheckedCount = 0;
      let hasAnyRecord = false;
      
      day.tasks.forEach(task => {
        let taskKey = task;
        if (task.includes("陰陽拳")) taskKey = "陰陽拳";
        else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
        else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
        
        if (records[taskKey] !== undefined) {
          hasAnyRecord = true;
          totalTasksAll++;
          if (records[taskKey] === true) {
            checkedTasksAll++;
            dayCheckedCount++;
          }
        }
      });

      // 加上自訂任務到統計總計中
      state.customTasks.forEach(task => {
        if (dateStr >= task.startDate && dateStr <= task.endDate) {
          if (records[task.id] !== undefined) {
            hasAnyRecord = true;
            totalTasksAll++;
            if (records[task.id] === true) {
              checkedTasksAll++;
              dayCheckedCount++;
            }
          }
        }
      });
      
      if (hasAnyRecord) {
        checkedDaysCount++;
      }
      
      // 統計「陰陽拳」省下罰款金額
      if (records["陰陽拳"] === true) {
        penaltiesSaved += 50;
      }

      // 統計角色任務打卡總次數
      if (records["角色任務"] === true) {
        roleTaskCheckedCount++;
      }
    }
  });
  
  // 計算角色任務目前的連續打卡天數
  // 我們從「當前選中日期(或今天)」往回推算，若昨天或今天有勾選，即可算連續
  let streakCheckDate = new Date(state.activeDate);
  // 如果勾選了，從當天開始；如果沒勾，從昨天開始
  let activeRecords = state.checkInHistory[state.activeDate];
  if (!activeRecords || !activeRecords["角色任務"]) {
    // 往回一天
    streakCheckDate.setDate(streakCheckDate.getDate() - 1);
  }
  
  while (true) {
    const y = streakCheckDate.getFullYear();
    const m = String(streakCheckDate.getMonth() + 1).padStart(2, '0');
    const d = String(streakCheckDate.getDate()).padStart(2, '0');
    const checkStr = `${y}-${m}-${d}`;
    
    // 檢查是否有這天的打卡，且角色任務有完成
    const records = state.checkInHistory[checkStr];
    if (records && records["角色任務"] === true) {
      currentStreak++;
      streakCheckDate.setDate(streakCheckDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // 計算角色任務歷史最高連續打卡天數
  let runningStreak = 0;
  CALENDAR_DATA.forEach(day => {
    const records = state.checkInHistory[day.date];
    if (records && records["角色任務"] === true) {
      runningStreak++;
      if (runningStreak > maxStreak) {
        maxStreak = runningStreak;
      }
    } else {
      runningStreak = 0; // 斷開連續
    }
  });
  
  const overallCompletionRate = totalTasksAll > 0 ? Math.round((checkedTasksAll / totalTasksAll) * 100) : 0;
  
  return {
    currentStreak,
    maxStreak,
    penaltiesSaved,
    checkedDaysCount,
    overallCompletionRate,
    roleTaskCheckedCount
  };
}

// 渲染「歷史月曆」分頁面板網格
function renderHistoryCalendarGrid() {
  const selectedMonth = parseInt(historyMonthSelectEl.value);
  historyDaysGridEl.innerHTML = "";
  
  // 獲取 2026 年對應月份的日期
  populateCalendarGrid(2026, selectedMonth, historyDaysGridEl, false);
}

// Modal 月曆功能
function openCalendarModal() {
  // 同步 Modal 的月份為當前日期的月份
  const dateParts = state.activeDate.split("-");
  state.modalYear = parseInt(dateParts[0]);
  state.modalMonth = parseInt(dateParts[1]);
  
  updateModalMonthTitle();
  renderModalCalendarGrid();
  calendarModalEl.classList.remove("hidden");
}

function closeCalendarModal() {
  calendarModalEl.classList.add("hidden");
}

function shiftModalMonth(direction) {
  state.modalMonth += direction;
  if (state.modalMonth < 5) {
    state.modalMonth = 5;
    showToast("ℹ️ 行事曆從 5 月開始！", "info");
    return;
  }
  if (state.modalMonth > 8) {
    state.modalMonth = 8;
    showToast("ℹ️ 行事曆到 8 月結束！", "info");
    return;
  }
  updateModalMonthTitle();
  renderModalCalendarGrid();
}

function updateModalMonthTitle() {
  modalMonthTitleEl.textContent = `${state.modalYear}年 ${state.modalMonth}月`;
}

function renderModalCalendarGrid() {
  modalDaysGridEl.innerHTML = "";
  populateCalendarGrid(state.modalYear, state.modalMonth, modalDaysGridEl, true);
}

// 通用月曆渲染引擎 (適用於歷史面板與 Modal)
function populateCalendarGrid(year, month, gridContainer, isModal = false) {
  // 1. 取得該月份第 1 天的星期 (1=Mon, 7=Sun)
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  const firstDay = new Date(year, month - 1, 1);
  let startWeekday = firstDay.getDay(); 
  if (startWeekday === 0) startWeekday = 7; // 將 Sun 改為 7
  
  // 2. 取得該月份的總天數
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  
  // 3. 渲染空白佔位單元格 (若月首非星期一)
  for (let i = 1; i < startWeekday; i++) {
    const pad = document.createElement("div");
    pad.className = "calendar-day-cell cell-outside-range";
    gridContainer.appendChild(pad);
  }
  
  // 4. 依序渲染當月所有天數
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // 檢查此日期是否在親證班有效打卡期內 (6/1 至 8/21)
    const dayData = CALENDAR_DATA.find(day => day.date === dateStr);
    
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    
    if (!dayData) {
      // 雖然是 6、7、8 月，但如果超出邊界(例如 8/22 之後)，將其淡化
      cell.classList.add("cell-outside-range");
      cell.innerHTML = `<span class="cell-num">${d}</span>`;
      gridContainer.appendChild(cell);
      continue;
    }
    
    // 設定農曆或特殊公告小字
    let noteText = dayData.lunar || "";
    if (dayData.note) {
      noteText = dayData.note.split("/")[0].trim().substring(0, 2);
    } else if (noteText.length > 2) {
      noteText = noteText.substring(0, 2);
    }
    
    cell.innerHTML = `
      <span class="cell-num">${d}</span>
      <span class="cell-note" style="color: ${dayData.note ? '#fbbf24' : ''}">${noteText}</span>
      <span class="cell-dot"></span>
    `;
    
    // 標記選中日期
    if (dateStr === state.activeDate) {
      cell.classList.add("cell-active-selected");
    }
    
    // 設定打卡狀態配色 class
    const statusClass = getDayCheckInStatusClass(dateStr);
    if (statusClass) {
      if (statusClass === "dot-success") cell.classList.add("cell-success");
      else if (statusClass === "dot-partial") cell.classList.add("cell-partial");
      else if (statusClass === "dot-missed") cell.classList.add("cell-missed");
    }
    
    // 點擊事件：直接跳轉到該日期
    cell.addEventListener("click", () => {
      state.activeDate = dateStr;
      
      if (isModal) {
        closeCalendarModal();
      }
      
      // 更新主畫面為剛選中的日期
      renderActiveDayPanel();
      renderWeekStrip();
      
      // 如果不是 Modal 點擊的，在歷史分頁中也重新選取
      if (!isModal) {
        // 清除其他格子的選中狀態並為當前上色
        const allCells = gridContainer.querySelectorAll(".calendar-day-cell");
        allCells.forEach(c => c.classList.remove("cell-active-selected"));
        cell.classList.add("cell-active-selected");
      }
    });
    
    gridContainer.appendChild(cell);
  }
}

// 匯出 JSON 備份數據
function exportUserData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.checkInHistory, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  const username = state.currentUser ? state.currentUser.name : "17小隊";
  
  // 產生 YYYYMMDDHHMM 格式的時間戳記
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
  
  dlAnchorElem.setAttribute("download", `打卡備份_${username}_${timestamp}.json`);
  dlAnchorElem.click();
  showToast("📥 打卡紀錄備份下載成功！", "success");
}

// 還原 JSON 備份數據
function importUserData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      
      // 基本結構驗證
      if (typeof imported === "object" && !Array.isArray(imported)) {
        state.checkInHistory = imported;
        saveHistoryToStorage();
        showToast("📤 打卡數據還原成功！", "success");
      } else {
        showToast("⚠️ 還原格式不符，請使用原備份 JSON 檔", "danger");
      }
    } catch (err) {
      showToast("❌ 解析檔案失敗，非標準 JSON 備份", "danger");
    }
  };
  reader.readAsText(file);
  // 清除 file input 重置
  e.target.value = "";
}

// 重置所有數據
function resetUserData() {
  if (confirm("⚠️ 警告：這將會永久刪除您在這個瀏覽器中所有的打卡歷史紀錄！確定要重設嗎？")) {
    state.checkInHistory = {};
    state.customTasks = [];
    saveHistoryToStorage();
    try {
      localStorage.removeItem("17checkin_custom_tasks");
    } catch(e) {}
    renderCustomTasksList();
    showToast("🧹 已清除所有打卡紀錄與自訂任務！", "success");
  }
}

// ================= 自訂任務核心模組 =================

// 註冊自訂任務按鈕事件監聽
function setupCustomTasksListeners() {
  // 顯示新增表單
  showAddCustomTaskBtnEl.addEventListener("click", () => {
    if (state.customTasks.length >= 5) {
      showToast("⚠️ 最多隻能新增 5 個自訂每日任務！", "danger");
      return;
    }
    addCustomTaskFormEl.style.display = "flex";
    showAddCustomTaskBtnEl.style.display = "none";
    
    // 初始化表單欄位預設值
    customTaskNameInputEl.value = "";
    customTaskModeSelectEl.value = "today-onwards";
    customTaskDateRangeGroupEl.style.display = "none";
    customTaskStartInputEl.value = state.activeDate;
    customTaskEndInputEl.value = "2026-08-21";
  });
  
  // 取消新增
  cancelAddCustomTaskBtnEl.addEventListener("click", () => {
    addCustomTaskFormEl.style.display = "none";
    showAddCustomTaskBtnEl.style.display = "block";
  });
  
  // 切換模式選單
  customTaskModeSelectEl.addEventListener("change", (e) => {
    if (e.target.value === "custom-range") {
      customTaskDateRangeGroupEl.style.display = "flex";
    } else {
      customTaskDateRangeGroupEl.style.display = "none";
    }
  });
  
  // 保存新增
  saveCustomTaskBtnEl.addEventListener("click", saveCustomTask);
  
  // 初次載入時渲染列表
  renderCustomTasksList();
}

// 渲染自訂任務管理列表 (Tab 2)
function renderCustomTasksList() {
  customTasksListEl.innerHTML = "";
  
  // 更新 Badge 數量
  customTasksCountBadgeEl.textContent = `${state.customTasks.length}/5`;
  
  if (state.customTasks.length === 0) {
    customTasksListEl.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px 0;">
        目前尚無自訂修行任務。
      </div>
    `;
    return;
  }
  
  state.customTasks.forEach(task => {
    const item = document.createElement("div");
    item.className = "custom-task-manage-item";
    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 12px;";
    
    const startStr = task.startDate.split("-").slice(1).join("/");
    const endStr = task.endDate.split("-").slice(1).join("/");
    
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: 13px; font-weight: 600; color: #fff;">${task.name}</span>
        <span style="font-size: 10px; color: var(--text-secondary);">區間: ${startStr} - ${endStr}</span>
      </div>
      <button class="delete-custom-btn" data-id="${task.id}" style="background: transparent; border: none; color: #ef4444; font-size: 14px; cursor: pointer; padding: 4px;">
        🗑️
      </button>
    `;
    
    // 註冊刪除按鈕
    item.querySelector(".delete-custom-btn").addEventListener("click", (e) => {
      const taskId = e.target.getAttribute("data-id");
      deleteCustomTask(taskId);
    });
    
    customTasksListEl.appendChild(item);
  });
}

// 儲存新增的自訂任務
function saveCustomTask() {
  const taskName = customTaskNameInputEl.value.trim();
  if (!taskName) {
    showToast("⚠️ 請輸入自訂任務名稱！", "danger");
    return;
  }
  
  const mode = customTaskModeSelectEl.value;
  let startDate = "";
  let endDate = "";
  
  if (mode === "today-onwards") {
    startDate = state.activeDate;
    endDate = "2026-08-21"; // 親證班畢業當天
  } else {
    startDate = customTaskStartInputEl.value;
    endDate = customTaskEndInputEl.value;
    
    if (!startDate || !endDate) {
      showToast("⚠️ 請選擇開始與結束日期！", "danger");
      return;
    }
    
    if (startDate > endDate) {
      showToast("⚠️ 開始日期不能大於結束日期！", "danger");
      return;
    }
    
    // 限制在行事曆的有效大區間內
    if (startDate < "2026-05-01" || endDate > "2026-08-21") {
      showToast("⚠️ 日期區間需介於 5/1 至 8/21 之間！", "danger");
      return;
    }
  }
  
  // 新增自訂任務對象
  const newTask = {
    id: "custom_" + Date.now(),
    name: taskName,
    startDate: startDate,
    endDate: endDate
  };
  
  state.customTasks.push(newTask);
  
  // 儲存
  try {
    localStorage.setItem("17checkin_custom_tasks", JSON.stringify(state.customTasks));
  } catch (e) {
    console.warn(e);
  }
  
  // 重置 UI
  addCustomTaskFormEl.style.display = "none";
  showAddCustomTaskBtnEl.style.display = "block";
  
  // 重新渲染與刷新
  renderCustomTasksList();
  renderActiveDayPanel();
  renderWeekStrip();
  updateStatsDashboard();
  
  showToast("➕ 自訂任務新增成功！", "success");
}

// 刪除自訂任務
function deleteCustomTask(taskId) {
  if (confirm("確定要刪除此自訂修行任務嗎？（歷史已打卡記錄將隱藏）")) {
    state.customTasks = state.customTasks.filter(t => t.id !== taskId);
    
    // 儲存
    try {
      localStorage.setItem("17checkin_custom_tasks", JSON.stringify(state.customTasks));
    } catch (e) {
      console.warn(e);
    }
    
    // 重新渲染與刷新
    renderCustomTasksList();
    renderActiveDayPanel();
    renderWeekStrip();
    updateStatsDashboard();
    
    showToast("🗑️ 已成功刪除自訂任務！", "success");
  }
}

// =======================================================
// 📈 修行數據分析報表渲染模組 (Interactive Reports Engine)
// =======================================================

function renderReports() {
  const currentSubTab = document.querySelector(".report-sub-tab.active");
  if (!currentSubTab) return;
  const tabId = currentSubTab.id;
  
  if (tabId === "reportTabDailyBtn") {
    renderDailyReport();
  } else if (tabId === "reportTabWeeklyBtn") {
    renderWeeklyReport();
  } else if (tabId === "reportTabMonthlyBtn") {
    renderMonthlyReport();
  }
}

function getTodayStr() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderDailyReport() {
  const container = document.getElementById("reportDailyContent");
  if (!container) return;
  
  const activeDayData = CALENDAR_DATA.find(d => d.date === state.activeDate);
  if (!activeDayData) return;
  
  const dayRecords = state.checkInHistory[state.activeDate] || {};
  
  // Title
  const dateObj = new Date(state.activeDate);
  const weekdayStr = ["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()];
  const displayDate = `${activeDayData.month}月${activeDayData.day}日 (${weekdayStr})`;
  
  // Calculate completion percentage
  let totalTasks = activeDayData.tasks.length;
  let checkedTasks = 0;
  
  activeDayData.tasks.forEach(task => {
    let taskKey = task;
    if (task.includes("陰陽拳")) taskKey = "陰陽拳";
    else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
    else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
    
    if (dayRecords[taskKey]) checkedTasks++;
  });
  
  state.customTasks.forEach(task => {
    if (state.activeDate >= task.startDate && state.activeDate <= task.endDate) {
      totalTasks++;
      if (dayRecords[task.id]) checkedTasks++;
    }
  });
  
  const percent = totalTasks > 0 ? Math.round((checkedTasks / totalTasks) * 100) : 0;
  
  // Status items HTML
  let itemsHtml = "";
  activeDayData.tasks.forEach(task => {
    let taskKey = task;
    let displayTitle = task;
    if (task.includes("陰陽拳")) {
      taskKey = "陰陽拳";
    } else if (task.includes("五感恩") || task.includes("觀心書")) {
      taskKey = "五感恩_觀心書";
    } else if (task.includes("嗯啊吽") || task.includes("角色任務")) {
      taskKey = "角色任務";
      displayTitle = state.currentUser.hiddenTask;
    }
    
    const isChecked = dayRecords[taskKey] || false;
    let badgeClass = "status-badge-pending";
    let badgeText = "⏳ 進行中";
    
    if (isChecked) {
      badgeClass = "status-badge-done";
      badgeText = "✅ 已完成";
    } else {
      const todayStr = getTodayStr();
      if (state.activeDate < todayStr) {
        badgeClass = "status-badge-missed";
        badgeText = "❌ 漏打卡";
      }
    }
    
    itemsHtml += `
      <div class="daily-status-item">
        <span style="font-weight: 500; color: #fff;">${displayTitle}</span>
        <span class="status-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  });
  
  state.customTasks.forEach(task => {
    if (state.activeDate >= task.startDate && state.activeDate <= task.endDate) {
      const isChecked = dayRecords[task.id] || false;
      const badgeClass = isChecked ? "status-badge-done" : (state.activeDate < getTodayStr() ? "status-badge-missed" : "status-badge-pending");
      const badgeText = isChecked ? "✅ 已完成" : (state.activeDate < getTodayStr() ? "❌ 漏打卡" : "⏳ 進行中");
      
      itemsHtml += `
        <div class="daily-status-item">
          <span style="font-weight: 500; color: #fff;">[自訂] ${task.name}</span>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }
  });

  const bannerText = percent === 100 ? "🎉 太棒了！今日定課 100% 圓滿！" : (percent > 0 ? "💪 加油！再接再厲，即將圓滿！" : "🧘 靜心專注，開啟今日的修行吧！");
  
  container.innerHTML = `
    <div class="daily-title-row">
      <span style="font-size: 15px; font-weight: 700; color: var(--primary-accent);">${displayDate}</span>
      <span style="font-size: 14px; font-weight: 700; color: #fff;">今日完成度：${percent}%</span>
    </div>
    
    <div class="progress-bar-outer" style="height: 6px; margin-bottom: 15px;">
      <div class="progress-bar-inner" style="width: ${percent}%; background: linear-gradient(90deg, var(--primary-accent) 0%, #60a5fa 100%);"></div>
    </div>
    
    <div style="font-size: 13px; font-weight: 600; color: #fbbf24; text-align: center; margin-bottom: 12px;">
      ${bannerText}
    </div>
    
    <div class="daily-status-list">
      ${itemsHtml}
    </div>
  `;
}

function renderWeeklyReport() {
  const container = document.getElementById("reportWeeklyContent");
  if (!container) return;
  
  // Find index of active date in CALENDAR_DATA
  const activeIdx = CALENDAR_DATA.findIndex(d => d.date === state.activeDate);
  if (activeIdx === -1) return;
  
  const currentDayData = CALENDAR_DATA[activeIdx];
  const weekday = currentDayData.weekday; // 1=Mon, 7=Sun
  const startIdx = activeIdx - (weekday - 1);
  
  let totalTasksWeek = 0;
  let checkedTasksWeek = 0;
  let penaltiesSavedWeek = 0;
  let daysCompleted100Count = 0;
  let progressItemsHtml = "";
  
  let startOfWeekStr = "";
  let endOfWeekStr = "";
  
  // We iterate through Monday to Sunday
  for (let i = 0; i < 7; i++) {
    const dayIdx = startIdx + i;
    if (dayIdx < 0 || dayIdx >= CALENDAR_DATA.length) continue;
    
    const dayData = CALENDAR_DATA[dayIdx];
    const records = state.checkInHistory[dayData.date] || {};
    
    if (i === 0) {
      const parts = dayData.date.split("-");
      startOfWeekStr = `${parts[1]}/${parts[2]}`;
    }
    if (i === 6) {
      const parts = dayData.date.split("-");
      endOfWeekStr = `${parts[1]}/${parts[2]}`;
    }
    
    let totalTasksDay = dayData.tasks.length;
    let checkedTasksDay = 0;
    
    dayData.tasks.forEach(task => {
      let taskKey = task;
      if (task.includes("陰陽拳")) taskKey = "陰陽拳";
      else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
      else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
      
      if (records[taskKey] !== undefined) {
        totalTasksWeek++;
        if (records[taskKey] === true) {
          checkedTasksWeek++;
          checkedTasksDay++;
        }
      }
    });
    
    state.customTasks.forEach(task => {
      if (dayData.date >= task.startDate && dayData.date <= task.endDate) {
        totalTasksDay++;
        totalTasksWeek++;
        if (records[task.id] === true) {
          checkedTasksWeek++;
          checkedTasksDay++;
        }
      }
    });
    
    if (records["陰陽拳"] === true) {
      penaltiesSavedWeek += 50;
    }
    
    const dayPercent = totalTasksDay > 0 ? Math.round((checkedTasksDay / totalTasksDay) * 100) : 0;
    if (dayPercent === 100) {
      daysCompleted100Count++;
    }
    
    const dayName = ["一", "二", "三", "四", "五", "六", "日"][i];
    const barColor = dayPercent === 100 ? "var(--success)" : (dayPercent > 0 ? "var(--primary-accent)" : "rgba(255,255,255,0.06)");
    
    progressItemsHtml += `
      <div class="weekly-progress-item">
        <span class="weekly-day-label">週${dayName}</span>
        <div class="weekly-bar-outer">
          <div class="weekly-bar-inner" style="width: ${dayPercent}%; background: ${barColor};"></div>
        </div>
        <span class="weekly-percent-label" style="color: ${dayPercent === 100 ? 'var(--success)' : ''}">${dayPercent}%</span>
      </div>
    `;
  }
  
  const averagePercent = totalTasksWeek > 0 ? Math.round((checkedTasksWeek / totalTasksWeek) * 100) : 0;
  
  // List weekly tasks and their status
  let weeklyTasksStatusHtml = "";
  const weeklyTaskMap = {};
  
  for (let i = 0; i < 7; i++) {
    const dayIdx = startIdx + i;
    if (dayIdx < 0 || dayIdx >= CALENDAR_DATA.length) continue;
    const dayData = CALENDAR_DATA[dayIdx];
    const records = state.checkInHistory[dayData.date] || {};
    
    dayData.tasks.forEach(task => {
      if (task.includes("週任務")) {
        const isChecked = records[task] || false;
        if (weeklyTaskMap[task] === undefined) {
          weeklyTaskMap[task] = isChecked;
        } else if (isChecked) {
          weeklyTaskMap[task] = true;
        }
      }
    });
  }
  
  const weeklyTaskKeys = Object.keys(weeklyTaskMap);
  if (weeklyTaskKeys.length > 0) {
    weeklyTasksStatusHtml += `
      <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 15px; margin-bottom: 8px;">📞 本週任務完成狀態：</div>
      <div class="daily-status-list">
    `;
    
    weeklyTaskKeys.forEach(task => {
      const isChecked = weeklyTaskMap[task];
      const badgeClass = isChecked ? "status-badge-done" : "status-badge-pending";
      const badgeText = isChecked ? "✅ 已完成" : "⏳ 進行中";
      
      weeklyTasksStatusHtml += `
        <div class="daily-status-item">
          <span style="font-weight: 500; color: #fff;">${task}</span>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    });
    
    weeklyTasksStatusHtml += `</div>`;
  }
  
  container.innerHTML = `
    <div class="daily-title-row" style="margin-bottom: 12px;">
      <span style="font-size: 14px; font-weight: 700; color: var(--primary-accent);">本週區間：${startOfWeekStr} - ${endOfWeekStr}</span>
      <span style="font-size: 14px; font-weight: 700; color: #fff;">週平均完成率：${averagePercent}%</span>
    </div>
    
    <div class="weekly-progress-list">
      ${progressItemsHtml}
    </div>
    
    <div class="weekly-summary-grid">
      <div class="weekly-summary-item" style="border-right: 1px solid rgba(255,255,255,0.08);">
        <span class="monthly-dist-val" style="color: var(--success);">${daysCompleted100Count} 天</span>
        <span class="monthly-dist-lbl">本週 100% 圓滿</span>
      </div>
      <div class="weekly-summary-item">
        <span class="monthly-dist-val" style="color: var(--color-gold);">$${penaltiesSavedWeek}</span>
        <span class="monthly-dist-lbl">本週省下罰金</span>
      </div>
    </div>
    
    ${weeklyTasksStatusHtml}
  `;
}

function renderMonthlyReport() {
  const container = document.getElementById("reportMonthlyContent");
  if (!container) return;
  
  const activeMonth = parseInt(state.activeDate.split("-")[1]);
  
  let totalTasksMonth = 0;
  let checkedTasksMonth = 0;
  let penaltiesSavedMonth = 0;
  
  let successDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  
  // Category-specific tasks completion rate
  let yinyangTotal = 0;
  let yinyangDone = 0;
  let gratitudeTotal = 0;
  let gratitudeDone = 0;
  let roleTotal = 0;
  let roleDone = 0;
  
  CALENDAR_DATA.forEach(day => {
    if (day.month !== activeMonth) return;
    
    const dateStr = day.date;
    const records = state.checkInHistory[dateStr] || {};
    
    let totalTasksDay = day.tasks.length;
    let checkedTasksDay = 0;
    let hasRecord = false;
    
    day.tasks.forEach(task => {
      let taskKey = task;
      if (task.includes("陰陽拳")) taskKey = "陰陽拳";
      else if (task.includes("五感恩") || task.includes("觀心書")) taskKey = "五感恩_觀心書";
      else if (task.includes("嗯啊吽") || task.includes("角色任務")) taskKey = "角色任務";
      
      if (records[taskKey] !== undefined) {
        hasRecord = true;
        totalTasksMonth++;
        if (records[taskKey] === true) {
          checkedTasksMonth++;
          checkedTasksDay++;
        }
        
        // Category specific counting
        if (taskKey === "陰陽拳") {
          yinyangTotal++;
          if (records[taskKey] === true) yinyangDone++;
        } else if (taskKey === "五感恩_觀心書") {
          gratitudeTotal++;
          if (records[taskKey] === true) gratitudeDone++;
        } else if (taskKey === "角色任務") {
          roleTotal++;
          if (records[taskKey] === true) roleDone++;
        }
      }
    });
    
    state.customTasks.forEach(task => {
      if (dateStr >= task.startDate && dateStr <= task.endDate) {
        totalTasksDay++;
        if (records[task.id] !== undefined) {
          hasRecord = true;
          totalTasksMonth++;
          if (records[task.id] === true) {
            checkedTasksMonth++;
            checkedTasksDay++;
          }
        }
      }
    });
    
    if (records["陰陽拳"] === true) {
      penaltiesSavedMonth += 50;
    }
    
    if (hasRecord) {
      const dayPercent = totalTasksDay > 0 ? Math.round((checkedTasksDay / totalTasksDay) * 100) : 0;
      const missedStatus = getDayCheckInStatusClass(dateStr);
      if (missedStatus === "dot-missed") {
        missedDays++;
      } else if (dayPercent === 100) {
        successDays++;
      } else if (dayPercent > 0) {
        partialDays++;
      }
    }
  });
  
  const averagePercent = totalTasksMonth > 0 ? Math.round((checkedTasksMonth / totalTasksMonth) * 100) : 0;
  
  const yinyangPercent = yinyangTotal > 0 ? Math.round((yinyangDone / yinyangTotal) * 100) : 0;
  const gratitudePercent = gratitudeTotal > 0 ? Math.round((gratitudeDone / gratitudeTotal) * 100) : 0;
  const rolePercent = roleTotal > 0 ? Math.round((roleDone / roleTotal) * 100) : 0;
  
  container.innerHTML = `
    <div class="daily-title-row" style="margin-bottom: 12px;">
      <span style="font-size: 14px; font-weight: 700; color: var(--primary-accent);">當前月份：2026年 ${activeMonth} 月</span>
      <span style="font-size: 14px; font-weight: 700; color: #fff;">月平均完成率：${averagePercent}%</span>
    </div>
    
    <div class="monthly-dist-grid">
      <div class="monthly-dist-card" style="border-bottom: 3px solid var(--success);">
        <div class="monthly-dist-val" style="color: var(--success);">${successDays}天</div>
        <div class="monthly-dist-lbl">🟢 100% 圓滿</div>
      </div>
      <div class="monthly-dist-card" style="border-bottom: 3px solid var(--warning);">
        <div class="monthly-dist-val" style="color: var(--warning);">${partialDays}天</div>
        <div class="monthly-dist-lbl">🟡 部分完成</div>
      </div>
      <div class="monthly-dist-card" style="border-bottom: 3px solid var(--danger);">
        <div class="monthly-dist-val" style="color: var(--danger);">${missedDays}天</div>
        <div class="monthly-dist-lbl">🔴 漏打卡天</div>
      </div>
    </div>
    
    <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 8px;">📊 核心定課完成率分析：</div>
    
    <div class="monthly-tasks-analysis">
      <!-- 陰陽拳 -->
      <div class="weekly-progress-item">
        <span class="weekly-day-label" style="width: 60px;">🥊 陰陽拳</span>
        <div class="weekly-bar-outer">
          <div class="weekly-bar-inner" style="width: ${yinyangPercent}%; background: var(--danger);"></div>
        </div>
        <span class="weekly-percent-label" style="color: var(--danger); width: 35px;">${yinyangPercent}%</span>
      </div>
      
      <!-- 五感恩 -->
      <div class="weekly-progress-item">
        <span class="weekly-day-label" style="width: 60px;">📝 五感恩</span>
        <div class="weekly-bar-outer">
          <div class="weekly-bar-inner" style="width: ${gratitudePercent}%; background: var(--success);"></div>
        </div>
        <span class="weekly-percent-label" style="color: var(--success); width: 35px;">${gratitudePercent}%</span>
      </div>
      
      <!-- 角色任務 -->
      <div class="weekly-progress-item">
        <span class="weekly-day-label" style="width: 60px;">🧘 角色任務</span>
        <div class="weekly-bar-outer">
          <div class="weekly-bar-inner" style="width: ${rolePercent}%; background: var(--primary-accent);"></div>
        </div>
        <span class="weekly-percent-label" style="color: var(--primary-accent); width: 35px;">${rolePercent}%</span>
      </div>
    </div>
    
    <div class="weekly-summary-grid" style="margin-top: 15px;">
      <div class="weekly-summary-item" style="border-right: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <span class="monthly-dist-val" style="color: var(--color-gold); font-size: 18px;">$${penaltiesSavedMonth}</span>
        <span class="monthly-dist-lbl">當月省下罰金</span>
      </div>
      <div class="weekly-summary-item" style="text-align: center;">
        <span class="monthly-dist-val" style="color: #fff; font-size: 18px;">${successDays + partialDays} 天</span>
        <span class="monthly-dist-lbl">累計打卡天數</span>
      </div>
    </div>
  `;
}

/* 輔助函式庫 */

// 獲取星期中文字
function getWeekdayName(dateStr) {
  const d = new Date(dateStr);
  return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
}

// 十六進位顏色轉 RGB 格式，供 CSS rgba 使用
function hexToRgb(hex) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',');
  }
  return "59,130,246"; // fallback to blue
}
