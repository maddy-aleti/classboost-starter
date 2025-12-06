// content.js
(function() {
const OVERLAY_ID = 'classboost-overlay';
let isDragging = false;
let offset = { x: 0, y: 0 };
let classScoreIntervalId = null;


function createOverlay() {
if (document.getElementById(OVERLAY_ID)) return;


const container = document.createElement('div');
container.id = OVERLAY_ID;
container.innerHTML =`<div class="cb-card">
  <div class="cb-header">ClassBoost — Teacher Panel</div>

  <div class="cb-body">
    <!-- Topic Input -->
    <label class="cb-label">Topic</label>
    <input id="cb-topic" type="text" class="cb-input" placeholder="e.g., Overfitting">

    <!-- Toggle switches -->
    <div class="cb-toggle-row">
      <span>Quiz Mode</span>
      <label class="cb-switch">
        <input type="checkbox" id="cb-quiz-toggle">
        <span class="cb-slider"></span>
      </label>
    </div>

    <div class="cb-toggle-row">
      <span>Auto GIF Suggestions</span>
      <label class="cb-switch">
        <input type="checkbox" id="cb-gif-toggle">
        <span class="cb-slider"></span>
      </label>
    </div>

    <!-- Buttons -->
    <button id="cb-trigger-quiz" class="cb-btn">Trigger Quiz</button>
    <button id="cb-match-students" class="cb-btn">Match Students</button>
    <button id="cb-show-engagement" class="cb-btn">Engagement Meter</button>
      <!-- Engagement Meter UI -->
  <div id="engagement-gauge" class="cb-gauge" style="padding:10px;margin-top:10px;border-radius:8px;text-align:center;border:2px solid gray;">
    <div id="engagement-value" style="font-size:18px;font-weight:bold;">--%</div>
    <div id="engagement-label" style="font-size:12px;">Waiting...</div>
  </div>

  <!-- Speedometer Modal trigger -->
  <div id="cb-speedometer-modal" style="display:none;">
    <div class="cb-speedometer-card">
      <div class="cb-speedometer-title">Engagement Meter</div>
      <svg class="cb-speedometer-svg" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stop-color="#e74c3c" />
            <stop offset="50%" stop-color="#f1c40f" />
            <stop offset="100%" stop-color="#2ecc71" />
          </linearGradient>
        </defs>
        <path d="M20 90 A80 80 0 0 1 180 90" fill="none" stroke="url(#g1)" stroke-width="12" stroke-linecap="round" />
        <g id="needle" class="cb-needle">
          <line x1="100" y1="90" x2="100" y2="30" stroke="#f3e9d2" stroke-width="3" />
          <circle cx="100" cy="90" r="5" fill="#f3e9d2" />
        </g>
        <text id="spd-percent" x="100" y="105" text-anchor="middle" fill="#f3e9d2" font-size="12">--%</text>
      </svg>
      <div class="cb-speedometer-legend">Status: <span id="spd-label">Waiting</span></div>
      <div style="margin-top:12px; display:flex; gap:8px; justify-content:center;">
        <button id="cb-close-speedometer" class="cb-btn-secondary">Close</button>
        <button id="cb-alert-clear" class="cb-btn">Dismiss Alert</button>
      </div>
    </div>
  </div>

  <div id="cb-alert-banner" class="cb-alert-banner">Low class attention — please re-engage the class</div>

    <!-- Open Modal -->
    <button id="cb-open-modal" class="cb-btn-secondary">Open Info Modal</button>
  </div>

  <div class="cb-footer">v0.2 UI</div>
</div>

<!-- Modal -->
<div id="cb-modal" class="cb-modal" style="display:none;">
  <div class="cb-modal-content">
    <h3>ClassBoost Info</h3>
    <p>This is a placeholder UI modal. You can wire functionality later.</p>
    <button id="cb-close-modal" class="cb-btn">Close</button>
  </div>
</div>`



document.body.appendChild(container);


document.getElementById('cb-open-modal').addEventListener('click', () => {
document.getElementById('cb-modal').style.display = 'flex';
});
  // Engagement Meter button opens speedometer modal
  document.getElementById('cb-show-engagement').addEventListener('click', () => {
    document.getElementById('cb-speedometer-modal').style.display = 'flex';
  });
  document.getElementById('cb-close-speedometer').addEventListener('click', () => {
    document.getElementById('cb-speedometer-modal').style.display = 'none';
  });
  document.getElementById('cb-alert-clear').addEventListener('click', () => {
    hideAlertBanner();
  });
document.getElementById('cb-close-modal').addEventListener('click', () => {
document.getElementById('cb-modal').style.display = 'none';
});
// start/replace periodic getClassScore poll; guard against extension reloads
if (classScoreIntervalId) {
  clearInterval(classScoreIntervalId);
}
classScoreIntervalId = setInterval(() => {
  try {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
    chrome.runtime.sendMessage({ type: 'getClassScore' }, (resp) => {
      try {
        if (chrome.runtime && chrome.runtime.lastError) {
          // background may be unreachable (extension reloaded/unloaded)
          console.warn('getClassScore sendMessage error', chrome.runtime.lastError && chrome.runtime.lastError.message);
          return;
        }
        if (!resp) return;
        // resp should be { ok: true, data: { classScore: ... } } or { ok:false, error: ... }
        if (resp.ok && resp.data) {
          try {
            if (chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'engagementUpdate', payload: resp.data }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  // harmless, but log for debugging
                  console.warn('engagementUpdate sendMessage error', chrome.runtime.lastError && chrome.runtime.lastError.message);
                }
              });
            }
          } catch (e) {
            console.warn('engagementUpdate sendMessage exception', e && e.message);
          }
        } else {
          console.warn('getClassScore failed', resp && resp.error);
        }
      } catch (inner) {
        console.error('callback error for getClassScore', inner);
      }
    });
  } catch (e) {
    // synchronous errors such as "Extension context invalidated"
    console.warn('getClassScore sendMessage failed (caught)', e && e.message);
  }
}, 5000);
}

// Drag functionality for overlay

document.addEventListener('mousedown', (e) => {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  
  const card = overlay.querySelector('.cb-card');
  if (!card || !card.contains(e.target) || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
  
  isDragging = true;
  card.classList.add('dragging');
  
  const rect = overlay.getBoundingClientRect();
  offset.x = e.clientX - rect.left;
  offset.y = e.clientY - rect.top;
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  
  overlay.style.left = (e.clientX - offset.x) + 'px';
  overlay.style.top = (e.clientY - offset.y) + 'px';
  overlay.style.right = 'auto';
  overlay.style.bottom = 'auto';
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  
  isDragging = false;
  const card = document.querySelector('.cb-card');
  if (card) card.classList.remove('dragging');
});


// Wait for the Meet page to load and keep trying (Meet loads dynamically)
const observer = new MutationObserver((mutations, obs) => {
// Insert overlay once a root element is present
if (document.body) {
createOverlay();
}
});
observer.observe(document, { childList: true, subtree: true });


// Also try after a short delay in case MutationObserver misses initial load
setTimeout(createOverlay, 1500);
// clear interval when page is unloading so we don't try to message invalidated extension
window.addEventListener('unload', () => {
  try {
    if (classScoreIntervalId) {
      clearInterval(classScoreIntervalId);
      classScoreIntervalId = null;
    }
  } catch (e) { }
});
})();

// content-engage.js (add into content.js)
(function() {
  const INTERVAL = 10000; // 10s
  let lastMouseTs = Date.now();
  let chatCount = 0, reactionCount = 0, lastPollAnswer = 0, lastQuizAnswer = 0;

  // simple mouse/keyboard activity
  window.addEventListener('mousemove', () => lastMouseTs = Date.now());
  window.addEventListener('keydown', () => lastMouseTs = Date.now());

  // hook: your quiz/poll UI should dispatch these events on answer
  window.addEventListener('classboost:pollAnswered', () => lastPollAnswer = Date.now());
  window.addEventListener('classboost:quizAnswered', () => lastQuizAnswer = Date.now());

  // WATCH chat/reaction via MutationObserver (broad; refine later)
  const obs = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n=>{
      try {
        if (n.nodeType === Node.ELEMENT_NODE && n.innerText && n.innerText.length>1) chatCount++;
        // heuristics: if node contains emoji-only or aria-label like 'reaction' increment reactionCount
        if (n.innerText && /[\u{1F300}-\u{1FAFF}]/u.test(n.innerText)) reactionCount++;
      } catch(e){ }
    }));
  });
  obs.observe(document.body, { childList:true, subtree:true });

  function computeSnapshot() {
    const now = Date.now();
    const poll = (now - lastPollAnswer) < 60000 ? 1 : 0;
    const quiz = (now - lastQuizAnswer) < 60000 ? 1 : 0;
    const chatNorm = Math.min(chatCount/3, 1);
    const reactNorm = Math.min(reactionCount/2, 1);
    const focus = document.hidden ? 0 : 1;
    const mouseNorm = (Date.now() - lastMouseTs) < 60000 ? 1 : 0;

    const raw = 0.3*poll + 0.3*quiz + 0.15*chatNorm + 0.1*reactNorm + 0.1*focus + 0.05*mouseNorm;

    // send to background to forward to server
    try {
      if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'engagementSnapshot', snapshot: { raw, components:{poll,quiz,chatNorm,reactNorm,focus,mouseNorm}, ts: now } }, (resp) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('engagementSnapshot sendMessage error', chrome.runtime.lastError && chrome.runtime.lastError.message);
          }
        });
      }
    } catch (e) {
      console.warn('engagementSnapshot sendMessage failed', e && e.message);
    }

    // reset counters
    chatCount = 0; reactionCount = 0;
  }

  setInterval(computeSnapshot, INTERVAL);
})();


if (window.chrome && chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      try {
        if (msg.type === 'engagementUpdate' || msg.payload?.classScore !== undefined) {
          const val = msg.payload ? msg.payload.classScore : msg.classScore;
          updateGauge(val);
        }
      } catch (e) { console.warn('onMessage handler error', e && e.message); }
    });
  } catch (e) {
    console.warn('failed to register onMessage listener', e && e.message);
  }
}

function updateGauge(val) {
  try {
    const percent = Math.round(val * 100);
    const label = val > 0.75 ? 'Engaged' : val > 0.45 ? 'Okay' : 'Low';

    const valueEl = document.getElementById('engagement-value');
    const labelEl = document.getElementById('engagement-label');
    const gaugeEl = document.getElementById('engagement-gauge');

    if (!valueEl || !labelEl || !gaugeEl) return; // UI not present

    valueEl.innerText = percent + '%';
    labelEl.innerText = label;
    gaugeEl.style.border = val > 0.75 ? '2px solid #2ecc71' : val > 0.45 ? '2px solid #f1c40f' : '2px solid #e74c3c';
  } catch (e) {
    console.error('updateGauge error', e);
  }
}

// Speedometer helpers and polling for teacher view
let speedometerInterval = null;
let alertShowing = false;

function showAlertBanner() {
  const b = document.getElementById('cb-alert-banner');
  if (!b) return;
  b.classList.add('show');
  alertShowing = true;
}

function hideAlertBanner() {
  const b = document.getElementById('cb-alert-banner');
  if (!b) return;
  b.classList.remove('show');
  alertShowing = false;
}

function setNeedlePercent(val) {
  // val: 0..1
  const degMin = -90; // left
  const degMax = 90; // right
  const deg = degMin + (degMax - degMin) * val;
  const needle = document.getElementById('needle');
  if (needle) {
    needle.style.transform = `translate(0,0) rotate(${deg}deg)`;
  }
  const p = document.getElementById('spd-percent');
  const lbl = document.getElementById('spd-label');
  if (p) p.textContent = Math.round(val*100) + '%';
  if (lbl) lbl.textContent = val > 0.75 ? 'Engaged' : val > 0.45 ? 'Okay' : 'Low';
}

function startTeacherPolling() {
  if (speedometerInterval) clearInterval(speedometerInterval);
  // initial fetch immediately
  fetchClassScoreAndUpdate();
  speedometerInterval = setInterval(fetchClassScoreAndUpdate, 3000);
}

function stopTeacherPolling() {
  if (speedometerInterval) clearInterval(speedometerInterval);
  speedometerInterval = null;
}

function fetchClassScoreAndUpdate() {
  try {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
    chrome.runtime.sendMessage({ type: 'getClassScore' }, (resp) => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      if (!resp || !resp.ok || !resp.data) return;
      const val = Number(resp.data.classScore) || 0;
      // update both small gauge and speedometer
      updateGauge(val);
      setNeedlePercent(val);

      // show alert to teacher if low (<0.45)
      if (val < 0.45 && !alertShowing) {
        showAlertBanner();
        // also open modal if teacher currently has it open
      }
      if (val >= 0.45 && alertShowing) {
        hideAlertBanner();
      }
    });
  } catch (e) { }
}

// Start polling when overlay is created
startTeacherPolling();

// clear polling on unload
window.addEventListener('beforeunload', () => stopTeacherPolling());


