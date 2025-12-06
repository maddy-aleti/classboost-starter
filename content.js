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
    <!-- Buttons (primary actions) -->
    <button id="cb-show-engagement" class="cb-btn">Engagement Meter</button>
    <button id="cb-match-trigger" class="cb-btn">Match Students & Quiz</button>
    <button id="cb-gen-gif" class="cb-btn">Generate GIF</button>
    <button id="cb-gen-flashcard" class="cb-btn">Generate Flashcard</button>
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
  </div>

  <div class="cb-footer">v0.2 UI</div>
</div>

<!-- Topic Input Modal (shared across actions) -->
<div id="cb-topic-modal" class="cb-modal" style="display:none;">
  <div class="cb-modal-content">
    <h3>Enter Topic</h3>
    <p id="cb-topic-prompt">What topic are you teaching?</p>
    <input id="cb-topic-input" type="text" class="cb-input" placeholder="e.g., Overfitting" style="margin-bottom:12px;">
    <div style="display:flex; gap:8px;">
      <button id="cb-topic-submit" class="cb-btn" style="flex:1;">Submit</button>
      <button id="cb-topic-cancel" class="cb-btn-secondary" style="flex:1;">Cancel</button>
    </div>
  </div>
</div>`



document.body.appendChild(container);

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

// Topic modal helpers
let pendingAction = null;
function showTopicModal(action, prompt) {
  pendingAction = action;
  const modal = document.getElementById('cb-topic-modal');
  const promptEl = document.getElementById('cb-topic-prompt');
  const input = document.getElementById('cb-topic-input');
  if (promptEl) promptEl.textContent = prompt;
  if (input) input.value = '';
  if (modal) modal.style.display = 'flex';
}

function hideTopicModal() {
  const modal = document.getElementById('cb-topic-modal');
  if (modal) modal.style.display = 'none';
  pendingAction = null;
}

function submitTopicAndExecute() {
  const input = document.getElementById('cb-topic-input');
  const topic = input ? input.value.trim() : '';
  console.log('[ContentScript] submitTopicAndExecute called, pendingAction:', pendingAction, 'topic:', topic);
  console.log('[ContentScript] pendingAction === "genGif"?', pendingAction === 'genGif');
  if (!topic) {
    showTempMessage('Please enter a topic');
    return;
  }
  
  // Store pendingAction BEFORE hideTopicModal clears it
  const action = pendingAction;
  console.log('[ContentScript] Stored action:', action);
  hideTopicModal();
  
  console.log('[ContentScript] After hideTopicModal, checking conditions with action:', action);
  if (action === 'matchQuiz') {
    console.log('[ContentScript] Matched matchQuiz');
    executeMatchQuiz(topic);
  } else if (action === 'genGif') {
    console.log('[ContentScript] Matched genGif, calling executeGenGif...');
    executeGenGif(topic);
  } else if (action === 'genFlash') {
    console.log('[ContentScript] Matched genFlash');
    executeGenFlashcard(topic);
  } else {
    console.log('[ContentScript] No action matched! action is:', JSON.stringify(action));
  }
}

// small temporary toast inside overlay
function showTempMessage(msg, timeout=3000) {
  try {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const t = document.createElement('div');
    t.className = 'cb-temp-msg';
    t.style.position = 'fixed';
    t.style.bottom = '22px';
    t.style.left = '50%';
    t.style.transform = 'translateX(-50%)';
    t.style.background = 'rgba(0,0,0,0.85)';
    t.style.color = '#f3e9d2';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '8px';
    t.style.zIndex = 2147483650;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>{ try { t.remove(); } catch(e){} }, timeout);
  } catch(e) { }
}

// Action execution functions
function executeMatchQuiz(topic) {
  showTempMessage('Matching students and triggering quiz...');
  try { if (chrome && chrome.runtime && chrome.runtime.sendMessage) chrome.runtime.sendMessage({ type: 'matchAndTriggerQuiz', payload: { topic } }); } catch(e){}
}

function executeGenGif(topic) {
  console.log('[ContentScript] executeGenGif called with topic:', topic);
  showTempMessage('Searching for GIF...');
  console.log('[ContentScript] Sending generateGif message to background...');
  try { 
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'generateGif', payload: { topic } }, (response) => {
        console.log('[ContentScript] Got response from background:', response);
        if (chrome.runtime.lastError) {
          console.error('[ContentScript] sendMessage error:', chrome.runtime.lastError);
        }
      });
    } else {
      console.error('[ContentScript] chrome.runtime.sendMessage not available');
    }
  } catch(e) {
    console.error('[ContentScript] executeGenGif error:', e);
  }
}

function executeGenFlashcard(topic) {
  showTempMessage('Generating flashcard...');
  try { if (chrome && chrome.runtime && chrome.runtime.sendMessage) chrome.runtime.sendMessage({ type: 'generateFlashcard', payload: { topic } }); } catch(e){}
}

// Wire action buttons to open topic modal
const matchTriggerBtn = document.getElementById('cb-match-trigger');
if (matchTriggerBtn) {
  matchTriggerBtn.addEventListener('click', () => {
    showTopicModal('matchQuiz', 'What topic for the competitive quiz?');
  });
}

const genGifBtn = document.getElementById('cb-gen-gif');
if (genGifBtn) {
  genGifBtn.addEventListener('click', () => {
    showTopicModal('genGif', 'What topic for the GIF?');
  });
}

const genFlashBtn = document.getElementById('cb-gen-flashcard');
if (genFlashBtn) {
  genFlashBtn.addEventListener('click', () => {
    showTopicModal('genFlash', 'What topic for the flashcard?');
  });
}

// Wire topic modal buttons
const topicSubmit = document.getElementById('cb-topic-submit');
if (topicSubmit) topicSubmit.addEventListener('click', submitTopicAndExecute);

const topicCancel = document.getElementById('cb-topic-cancel');
if (topicCancel) topicCancel.addEventListener('click', hideTopicModal);

// Allow Enter key to submit
const topicInput = document.getElementById('cb-topic-input');
if (topicInput) topicInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitTopicAndExecute();
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
        // Start competitive quiz on student tabs
        if (msg.type === 'startCompetitiveQuiz' && msg.payload) {
          try { showCompetitiveQuiz(msg.payload); } catch (e) { }
        }
        // Student receives quiz result
        if (msg.type === 'quizResult' && msg.payload) {
          try { showQuizOutcome(msg.payload); } catch (e) { }
        }
        // Teacher / all tabs can receive finished event to display results
        if (msg.type === 'competitiveQuizFinished' && msg.payload) {
          try { showCompetitiveSummary(msg.payload); } catch (e) { }
        }
        // Display GIF result
        if (msg.type === 'gifResult' && msg.payload) {
          try { showGifModal(msg.payload); } catch (e) { console.error('Error showing GIF', e); }
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

// ===== GIF Modal Display =====
function removeGifModal() {
  const ex = document.getElementById('cb-gif-modal');
  if (ex) try { ex.remove(); } catch(e){}
}

function showGifModal(payload) {
  removeGifModal();
  const { gifUrl, topic, error } = payload;
  
  if (error) {
    try {
      showTempMessage('GIF not found for: ' + topic, 4000);
    } catch (e) {
      console.error('[GIF Modal] Error showing temp message:', e);
      alert('GIF not found for: ' + topic);
    }
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'cb-gif-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0,0,0,0.7)';
  modal.style.zIndex = '2147483651';

  const card = document.createElement('div');
  card.style.background = '#0f0f10';
  card.style.color = '#f3e9d2';
  card.style.padding = '20px';
  card.style.borderRadius = '10px';
  card.style.width = '500px';
  card.style.maxWidth = '90vw';
  card.style.textAlign = 'center';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';

  const title = document.createElement('h3');
  title.textContent = 'GIF: ' + topic;
  title.style.marginBottom = '12px';
  title.style.color = '#f3e9d2';

  const img = document.createElement('img');
  img.src = gifUrl;
  img.style.width = '100%';
  img.style.borderRadius = '8px';
  img.style.marginBottom = '12px';
  img.style.maxHeight = '400px';
  img.style.objectFit = 'contain';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'cb-btn';
  closeBtn.style.width = '100%';
  closeBtn.addEventListener('click', removeGifModal);

  card.appendChild(title);
  card.appendChild(img);
  card.appendChild(closeBtn);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) removeGifModal();
  });
}

// ===== Competitive Quiz UI =====
function showCompetitiveQuiz(quiz) {
  // remove any existing
  removeCompetitiveQuiz();
  const modal = document.createElement('div');
  modal.id = 'cb-competitive-quiz';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0,0,0,0.6)';
  modal.style.zIndex = 2147483651;

  const card = document.createElement('div');
  card.style.background = '#0f0f10';
  card.style.color = '#f3e9d2';
  card.style.padding = '16px';
  card.style.borderRadius = '10px';
  card.style.width = '360px';
  card.style.textAlign = 'center';

  const q = document.createElement('div');
  q.textContent = quiz.question || 'Question';
  q.style.marginBottom = '12px';
  q.style.fontWeight = '600';

  const opts = document.createElement('div');
  opts.style.display = 'flex';
  opts.style.flexDirection = 'column';
  opts.style.gap = '8px';

  quiz.options.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.textContent = opt;
    b.className = 'cb-btn';
    b.style.width = '100%';
    b.addEventListener('click', () => {
      submitQuizAnswer(quiz.quizId, idx);
      // disable buttons
      Array.from(opts.querySelectorAll('button')).forEach(bt => bt.disabled = true);
      b.style.opacity = '0.8';
    });
    opts.appendChild(b);
  });

  const timer = document.createElement('div');
  timer.style.marginTop = '10px';
  timer.style.fontSize = '13px';
  timer.id = 'cb-quiz-timer';
  card.appendChild(q);
  card.appendChild(opts);
  card.appendChild(timer);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // start countdown
  let remaining = quiz.duration || 60;
  timer.textContent = `Time left: ${remaining}s`;
  const iv = setInterval(() => {
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(iv);
      // auto-remove after time
      try { removeCompetitiveQuiz(); } catch (e) {}
      return;
    }
    if (document.getElementById('cb-quiz-timer')) document.getElementById('cb-quiz-timer').textContent = `Time left: ${remaining}s`;
  }, 1000);
}

function removeCompetitiveQuiz() {
  const ex = document.getElementById('cb-competitive-quiz');
  if (ex) try { ex.remove(); } catch(e){}
}

function submitQuizAnswer(quizId, selectedIndex) {
  try {
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'quizAnswer', payload: { quizId, selectedIndex, ts: Date.now() } }, (resp)=>{});
    }
  } catch (e) { }
}

function showQuizOutcome(payload) {
  // show a small toast informing student whether they won or were correct
  const yourCorrect = payload.yourCorrect;
  const winner = payload.winner;
  const quiz = payload.quiz;
  removeCompetitiveQuiz();
  const msg = yourCorrect ? (winner ? (winner && winner === undefined ? 'Result' : (winner ? ('' ) : '')) : '') : '';
  // simpler message
  const text = yourCorrect ? (payload.yourCorrect ? 'You answered correctly!' : 'You answered incorrectly.') : 'Time up.';
  showTempMessage(text, 4000);
}

function showCompetitiveSummary(payload) {
  // show teacher and others the summary briefly
  const winner = payload.winner;
  const results = payload.results || [];
  if (!winner) {
    showTempMessage('Competitive quiz finished: no winner', 4000);
  } else {
    showTempMessage('Competitive quiz finished. Winner tabId: ' + winner, 5000);
  }
}


