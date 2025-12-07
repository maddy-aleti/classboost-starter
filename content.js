// content.js
(function () {
  const OVERLAY_ID = "classboost-overlay";
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  let classScoreIntervalId = null;

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const container = document.createElement("div");
    container.id = OVERLAY_ID;
    container.innerHTML = `<div class="cb-card">
  <div class="cb-header">ClassBoost — Teacher Panel</div>

  <div class="cb-body">
    <!-- Buttons (primary actions) -->
    <button id="cb-show-engagement" class="cb-btn">Engagement Meter</button>
    <button id="cb-pair-participants" class="cb-btn">Pair & Post Chat Links</button>
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
</div>`;

    document.body.appendChild(container);

    // Engagement Meter button opens speedometer modal
    document
      .getElementById("cb-show-engagement")
      .addEventListener("click", () => {
        document.getElementById("cb-speedometer-modal").style.display = "flex";
      });
    document
      .getElementById("cb-close-speedometer")
      .addEventListener("click", () => {
        document.getElementById("cb-speedometer-modal").style.display = "none";
      });
    document.getElementById("cb-alert-clear").addEventListener("click", () => {
      hideAlertBanner();
    });

    // Topic modal helpers
    let pendingAction = null;
    function showTopicModal(action, prompt) {
      pendingAction = action;
      const modal = document.getElementById("cb-topic-modal");
      const promptEl = document.getElementById("cb-topic-prompt");
      const input = document.getElementById("cb-topic-input");
      if (promptEl) promptEl.textContent = prompt;
      if (input) input.value = "";
      if (modal) modal.style.display = "flex";
    }

    function hideTopicModal() {
      const modal = document.getElementById("cb-topic-modal");
      if (modal) modal.style.display = "none";
      pendingAction = null;
    }

    function submitTopicAndExecute() {
      console.log(
        "[ContentScript] submitTopicAndExecute called, pendingAction:",
        pendingAction
      );
      const input = document.getElementById("cb-topic-input");
      const topic = input ? input.value.trim() : "";
      console.log("[ContentScript] Topic entered:", topic);
      if (!topic) {
        showTempMessage("Please enter a topic");
        return;
      }
      // Save action BEFORE hiding modal (hideTopicModal sets pendingAction to null)
      const action = pendingAction;
      console.log("[ContentScript] Saved action:", action);
      console.log("[ContentScript] Calling hideTopicModal...");
      hideTopicModal();
      console.log(
        "[ContentScript] After hideTopicModal, pendingAction:",
        pendingAction
      );
      if (action === "matchQuiz") {
        console.log(
          "[ContentScript] Matched matchQuiz, calling executeMatchQuiz..."
        );
        executeMatchQuiz(topic);
      } else if (action === "genGif") {
        console.log("[ContentScript] Matched genGif, calling executeGenGif...");
        executeGenGif(topic);
      } else if (action === "genFlash") {
        console.log(
          "[ContentScript] Matched genFlash, calling executeGenFlashcard..."
        );
        executeGenFlashcard(topic);
      } else {
        console.warn("[ContentScript] No matching action for action:", action);
      }
    }

    // small temporary toast inside overlay
    function showTempMessage(msg, timeout = 3000) {
      try {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) return;
        const t = document.createElement("div");
        t.className = "cb-temp-msg";
        t.style.position = "fixed";
        t.style.bottom = "22px";
        t.style.left = "50%";
        t.style.transform = "translateX(-50%)";
        t.style.background = "rgba(0,0,0,0.85)";
        t.style.color = "#f3e9d2";
        t.style.padding = "8px 12px";
        t.style.borderRadius = "8px";
        t.style.zIndex = 2147483650;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => {
          try {
            t.remove();
          } catch (e) {}
        }, timeout);
      } catch (e) {}
    }

    // Action execution functions
    function executeMatchQuiz(topic) {
      showTempMessage("Matching students and triggering quiz...");
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage)
          chrome.runtime.sendMessage({
            type: "matchAndTriggerQuiz",
            payload: { topic },
          });
      } catch (e) {}
    }

    function executeGenGif(topic) {
      console.log("[ContentScript] executeGenGif called with topic:", topic);
      showTempMessage("🎬 Generating GIF for: " + topic);
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          console.log(
            "[ContentScript] Sending generateGif message to background..."
          );
          chrome.runtime.sendMessage(
            {
              type: "generateGif",
              payload: { topic },
            },
            (response) => {
              // Suppress "Extension context invalidated" - it's expected when extension reloads
              if (chrome.runtime && chrome.runtime.lastError) {
                const errMsg = chrome.runtime.lastError.message || "";
                if (errMsg.includes("context invalidated")) {
                  console.warn(
                    "[ContentScript] Extension context invalidated (expected during reload)"
                  );
                } else {
                  console.error("[ContentScript] Background error:", errMsg);
                  showTempMessage("❌ Error: " + errMsg);
                }
                return;
              }
              console.log(
                "[ContentScript] Got response from background:",
                response
              );
              if (response && response.ok) {
                console.log("[ContentScript] GIF URL:", response.gifUrl);
                showTempMessage("✅ GIF found! Check your Meet chat.");
              } else if (response && response.error) {
                console.warn("[ContentScript] GIF error:", response.error);
                showTempMessage("❌ GIF not found: " + response.error);
              }
            }
          );
        } else {
          console.error(
            "[ContentScript] chrome.runtime.sendMessage not available"
          );
        }
      } catch (e) {
        // Suppress "Extension context invalidated" in catch block too
        if (e && e.message && e.message.includes("context invalidated")) {
          console.warn(
            "[ContentScript] Extension context invalidated (expected during reload)"
          );
        } else {
          console.error("[ContentScript] executeGenGif error:", e);
          showTempMessage("❌ Error: " + (e.message || "Unknown error"));
        }
      }
    }

    function executeGenFlashcard(topic) {
      console.log(
        "[ContentScript] executeGenFlashcard called with topic:",
        topic
      );
      showTempMessage("📇 Generating flashcard for: " + topic);
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          console.log(
            "[ContentScript] Sending generateFlashcard message to background..."
          );
          chrome.runtime.sendMessage(
            {
              type: "generateFlashcard",
              payload: { topic },
            },
            (response) => {
              // Suppress "Extension context invalidated" - it's expected when extension reloads
              if (chrome.runtime && chrome.runtime.lastError) {
                const errMsg = chrome.runtime.lastError.message || "";
                if (errMsg.includes("context invalidated")) {
                  console.warn(
                    "[ContentScript] Extension context invalidated (expected during reload)"
                  );
                } else {
                  console.error("[ContentScript] Background error:", errMsg);
                  showTempMessage("❌ Error: " + errMsg);
                }
                return;
              }
              console.log(
                "[ContentScript] Got response from background:",
                response
              );
              if (response && response.ok) {
                console.log("[ContentScript] Flashcard:", response.flashcard);
                showTempMessage("✅ Flashcard created! Check your Meet chat.");
              } else if (response && response.error) {
                console.warn(
                  "[ContentScript] Flashcard error:",
                  response.error
                );
                showTempMessage("❌ Flashcard error: " + response.error);
              }
            }
          );
        } else {
          console.error(
            "[ContentScript] chrome.runtime.sendMessage not available"
          );
        }
      } catch (e) {
        // Suppress "Extension context invalidated" in catch block too
        if (e && e.message && e.message.includes("context invalidated")) {
          console.warn(
            "[ContentScript] Extension context invalidated (expected during reload)"
          );
        } else {
          console.error("[ContentScript] executeGenFlashcard error:", e);
          showTempMessage("❌ Error: " + (e.message || "Unknown error"));
        }
      }
    }

    // Extract participant names from Google Meet
    function getParticipantNames() {
      const participants = [];

      // Try to find participant names from the Meet UI
      // Look for participant list items
      const participantItems = document.querySelectorAll(
        "[data-participant-id]"
      );

      participantItems.forEach((item) => {
        const nameElement = item.querySelector("[data-is-presenter], span");
        if (nameElement) {
          const name = nameElement.textContent.trim();
          if (name && name.length > 0) {
            participants.push(name);
          }
        }
      });

      // Alternative: try to find names in the participant panel
      if (participants.length === 0) {
        const participantPanel = document.querySelector(
          '[aria-label*="participant"], [role="listbox"]'
        );
        if (participantPanel) {
          const nameElements = participantPanel.querySelectorAll("span, div");
          nameElements.forEach((el) => {
            const text = el.textContent.trim();
            if (
              text &&
              text.length > 2 &&
              text.length < 50 &&
              !text.includes("participant") &&
              !text.includes("Participant")
            ) {
              if (!participants.includes(text)) {
                participants.push(text);
              }
            }
          });
        }
      }

      return [...new Set(participants)].filter((p) => p.length > 0);
    }

    // Shuffle array (Fisher-Yates)
    function shuffleArray(arr) {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    // Pair participants
    function pairParticipants(participants) {
      const shuffled = shuffleArray(participants);
      const pairs = [];

      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          const randomId = Math.floor(Math.random() * 10000) + 1000;
          pairs.push({
            name1: shuffled[i],
            name2: shuffled[i + 1],
            roomId: randomId,
          });
        } else if (shuffled.length % 2 === 1) {
          // Handle odd number - create pair with last person as facilitator or create their own room
          pairs.push({
            name1: shuffled[i],
            name2: "Self Study",
            roomId: Math.floor(Math.random() * 10000) + 1000,
          });
        }
      }

      return pairs;
    }

    // Post message to Google Meet chat
    function postToChat(message) {
      return new Promise((resolve) => {
        try {
          // Find the chat input area
          const chatInputAreas = document.querySelectorAll(
            '[contenteditable="true"], textarea, input[placeholder*="chat"], input[placeholder*="message"]'
          );

          let chatInput = null;
          for (let input of chatInputAreas) {
            const parent = input.parentElement;
            // Look for send button nearby to confirm this is the chat input
            const sendBtn = parent
              ? parent.querySelector(
                  'button[aria-label*="send"], button[aria-label*="Send"]'
                )
              : null;
            if (
              sendBtn ||
              input.placeholder.toLowerCase().includes("message")
            ) {
              chatInput = input;
              break;
            }
          }

          if (chatInput) {
            // Set the text
            if (chatInput.contentEditable === "true") {
              chatInput.textContent = message;
              chatInput.innerText = message;
            } else {
              chatInput.value = message;
            }

            // Trigger input event
            const inputEvent = new Event("input", { bubbles: true });
            chatInput.dispatchEvent(inputEvent);

            // Find and click send button
            const sendBtn = chatInput
              .closest('[role="region"]')
              ?.querySelector(
                'button[aria-label*="send"], button[aria-label*="Send"], button[type="submit"]'
              );
            if (sendBtn) {
              setTimeout(() => {
                sendBtn.click();
                resolve(true);
              }, 100);
            } else {
              // Try pressing Enter
              const enterEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
              });
              chatInput.dispatchEvent(enterEvent);
              setTimeout(() => resolve(true), 100);
            }
          } else {
            console.error("Chat input not found");
            resolve(false);
          }
        } catch (e) {
          console.error("Error posting to chat:", e);
          resolve(false);
        }
      });
    }

    // Main execution function
    async function executePairAndPostLinks() {
      showTempMessage("Getting participants...");

      const participants = getParticipantNames();

      if (participants.length < 2) {
        showTempMessage("Need at least 2 participants to pair");
        return;
      }

      showTempMessage(
        `Found ${participants.length} participants. Creating pairs...`
      );

      const pairs = pairParticipants(participants);

      // Create default quiz (can be customized later)
      const defaultQuiz = {
        title: "Competitive Quiz",
        description: "A quick competitive quiz for paired participants",
        questions: [
          {
            question: "What is 2 + 2?",
            options: ["3", "4", "5", "6"],
            correct_answer: 1,
          },
          {
            question: "What is the capital of France?",
            options: ["London", "Berlin", "Paris", "Madrid"],
            correct_answer: 2,
          },
          {
            question: "Which planet is closest to the Sun?",
            options: ["Venus", "Mercury", "Earth", "Mars"],
            correct_answer: 1,
          },
        ],
        duration: 60,
        difficulty: "easy",
      };

      // Build chat messages with quiz links
      let chatMessage = "Pair Assignments with Quiz Links:\n\n";

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        // Create quiz for this pair via API
        let quizId = null;
        try {
          const quizResponse = await fetch(
            "http://127.0.0.1:8000/api/quiz/create/",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(defaultQuiz),
            }
          );

          if (quizResponse.ok) {
            const quizData = await quizResponse.json();
            if (quizData.ok) {
              quizId = quizData.data.id;
            }
          }
        } catch (e) {
          console.error("Error creating quiz:", e);
        }

        // Generate room link with quiz parameter
        const roomLink = quizId
          ? `http://127.0.0.1:8000/chat/${pair.roomId}?quiz=${quizId}`
          : `http://127.0.0.1:8000/chat/${pair.roomId}`;

        chatMessage += `${pair.name1}-${pair.name2}: ${roomLink}\n`;
      }

      console.log("Chat message to send:", chatMessage);
      showTempMessage("Posting to chat...");

      // Post to chat
      const posted = await postToChat(chatMessage);

      if (posted) {
        showTempMessage("Chat links posted successfully!");
      } else {
        showTempMessage("Failed to post to chat. Message copied to console.");
        console.log("Chat message:", chatMessage);
      }
    }

    // Pair participants and post chat links
    const pairParticipantsBtn = document.getElementById("cb-pair-participants");
    if (pairParticipantsBtn) {
      pairParticipantsBtn.addEventListener("click", () => {
        executePairAndPostLinks();
      });
    }

    // Wire action buttons to open topic modal
    const matchTriggerBtn = document.getElementById("cb-match-trigger");
    if (matchTriggerBtn) {
      matchTriggerBtn.addEventListener("click", () => {
        showTopicModal("matchQuiz", "What topic for the competitive quiz?");
      });
    }

    const genGifBtn = document.getElementById("cb-gen-gif");
    if (genGifBtn) {
      genGifBtn.addEventListener("click", () => {
        showTopicModal("genGif", "What topic for the GIF?");
      });
    }

    const genFlashBtn = document.getElementById("cb-gen-flashcard");
    if (genFlashBtn) {
      genFlashBtn.addEventListener("click", () => {
        showTopicModal("genFlash", "What topic for the flashcard?");
      });
    }

    // Wire topic modal buttons
    const topicSubmit = document.getElementById("cb-topic-submit");
    if (topicSubmit)
      topicSubmit.addEventListener("click", submitTopicAndExecute);

    const topicCancel = document.getElementById("cb-topic-cancel");
    if (topicCancel) topicCancel.addEventListener("click", hideTopicModal);

    // Allow Enter key to submit
    const topicInput = document.getElementById("cb-topic-input");
    if (topicInput)
      topicInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitTopicAndExecute();
      });
    // start/replace periodic getClassScore poll; guard against extension reloads
    if (classScoreIntervalId) {
      clearInterval(classScoreIntervalId);
    }
    classScoreIntervalId = setInterval(() => {
      try {
        if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage)
          return;
        chrome.runtime.sendMessage({ type: "getClassScore" }, (resp) => {
          try {
            if (chrome.runtime && chrome.runtime.lastError) {
              // Suppress "Extension context invalidated" warnings - they're expected during reloads
              if (
                !chrome.runtime.lastError.message.includes(
                  "context invalidated"
                )
              ) {
                console.warn(
                  "getClassScore sendMessage error",
                  chrome.runtime.lastError && chrome.runtime.lastError.message
                );
              }
              return;
            }
            if (!resp) return;
            // resp should be { ok: true, data: { classScore: ... } } or { ok:false, error: ... }
            if (resp.ok && resp.data) {
              try {
                if (chrome.runtime && chrome.runtime.sendMessage) {
                  chrome.runtime.sendMessage(
                    { type: "engagementUpdate", payload: resp.data },
                    () => {
                      if (chrome.runtime && chrome.runtime.lastError) {
                        // harmless, but log for debugging
                        if (
                          !chrome.runtime.lastError.message.includes(
                            "context invalidated"
                          )
                        ) {
                          console.warn(
                            "engagementUpdate sendMessage error",
                            chrome.runtime.lastError &&
                              chrome.runtime.lastError.message
                          );
                        }
                      }
                    }
                  );
                }
              } catch (e) {
                // Suppress context invalidated errors during extension reload
                if (!e.message?.includes("context invalidated")) {
                  console.warn(
                    "engagementUpdate sendMessage exception",
                    e && e.message
                  );
                }
              }
            } else {
              // Only log actual errors, not context invalidated
              if (resp?.error && !resp.error.includes("context invalidated")) {
                console.warn("getClassScore failed", resp && resp.error);
              }
            }
          } catch (inner) {
            console.error("callback error for getClassScore", inner);
          }
        });
      } catch (e) {
        // Suppress "Extension context invalidated" warnings - they're expected
        if (e && e.message && !e.message.includes("context invalidated")) {
          console.warn(
            "getClassScore sendMessage failed (caught)",
            e && e.message
          );
        }
      }
    }, 5000);
  }

  // Drag functionality for overlay

  document.addEventListener("mousedown", (e) => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const card = overlay.querySelector(".cb-card");
    if (
      !card ||
      !card.contains(e.target) ||
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "INPUT"
    )
      return;

    isDragging = true;
    card.classList.add("dragging");

    const rect = overlay.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    overlay.style.left = e.clientX - offset.x + "px";
    overlay.style.top = e.clientY - offset.y + "px";
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    const card = document.querySelector(".cb-card");
    if (card) card.classList.remove("dragging");
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
  window.addEventListener("unload", () => {
    try {
      if (classScoreIntervalId) {
        clearInterval(classScoreIntervalId);
        classScoreIntervalId = null;
      }
    } catch (e) {}
  });
})();

// content-engage.js (add into content.js)
(function () {
  const INTERVAL = 10000; // 10s
  let lastMouseTs = Date.now();
  let chatCount = 0,
    reactionCount = 0,
    lastPollAnswer = 0,
    lastQuizAnswer = 0;

  // simple mouse/keyboard activity
  window.addEventListener("mousemove", () => (lastMouseTs = Date.now()));
  window.addEventListener("keydown", () => (lastMouseTs = Date.now()));

  // hook: your quiz/poll UI should dispatch these events on answer
  window.addEventListener(
    "classboost:pollAnswered",
    () => (lastPollAnswer = Date.now())
  );
  window.addEventListener(
    "classboost:quizAnswered",
    () => (lastQuizAnswer = Date.now())
  );

  // WATCH chat/reaction via MutationObserver (broad; refine later)
  const obs = new MutationObserver((muts) => {
    muts.forEach((m) =>
      m.addedNodes.forEach((n) => {
        try {
          if (
            n.nodeType === Node.ELEMENT_NODE &&
            n.innerText &&
            n.innerText.length > 1
          )
            chatCount++;
          // heuristics: if node contains emoji-only or aria-label like 'reaction' increment reactionCount
          if (n.innerText && /[\u{1F300}-\u{1FAFF}]/u.test(n.innerText))
            reactionCount++;
        } catch (e) {}
      })
    );
  });
  obs.observe(document.body, { childList: true, subtree: true });

  function computeSnapshot() {
    const now = Date.now();
    const poll = now - lastPollAnswer < 60000 ? 1 : 0;
    const quiz = now - lastQuizAnswer < 60000 ? 1 : 0;
    const chatNorm = Math.min(chatCount / 3, 1);
    const reactNorm = Math.min(reactionCount / 2, 1);
    const focus = document.hidden ? 0 : 1;
    const mouseNorm = Date.now() - lastMouseTs < 60000 ? 1 : 0;

    const raw =
      0.3 * poll +
      0.3 * quiz +
      0.15 * chatNorm +
      0.1 * reactNorm +
      0.1 * focus +
      0.05 * mouseNorm;

    // send to background to forward to server
    try {
      if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: "engagementSnapshot",
            snapshot: {
              raw,
              components: { poll, quiz, chatNorm, reactNorm, focus, mouseNorm },
              ts: now,
            },
          },
          (resp) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn(
                "engagementSnapshot sendMessage error",
                chrome.runtime.lastError && chrome.runtime.lastError.message
              );
            }
          }
        );
      }
    } catch (e) {
      // Suppress "Extension context invalidated" warnings - they're expected during extension reloads
      if (e && e.message && !e.message.includes("context invalidated")) {
        console.warn("engagementSnapshot sendMessage failed", e && e.message);
      }
    }

    // reset counters
    chatCount = 0;
    reactionCount = 0;
  }

  setInterval(computeSnapshot, INTERVAL);
})();

// Display GIF or Flashcard in a modal - GLOBAL SCOPE
function displayMediaModal(type, title, content) {
  try {
    // Create backdrop overlay
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.top = "0";
    backdrop.style.left = "0";
    backdrop.style.width = "100%";
    backdrop.style.height = "100%";
    backdrop.style.background = "rgba(0,0,0,0.6)";
    backdrop.style.zIndex = "2147483640";
    backdrop.style.display = "flex";
    backdrop.style.alignItems = "center";
    backdrop.style.justifyContent = "center";

    // Create modal container
    const modal = document.createElement("div");
    modal.style.position = "relative";
    modal.style.background = "white";
    modal.style.borderRadius = "12px";
    modal.style.padding = "24px";
    modal.style.maxWidth = "90vw";
    modal.style.maxHeight = "90vh";
    modal.style.overflow = "auto";
    modal.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";

    // Add title
    const titleEl = document.createElement("h2");
    titleEl.textContent = title;
    titleEl.style.margin = "0 0 16px 0";
    titleEl.style.color = "#333";
    titleEl.style.fontSize = "20px";
    titleEl.style.fontWeight = "600";
    modal.appendChild(titleEl);

    // Add content
    if (type === "gif") {
      const img = document.createElement("img");
      img.src = content;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "60vh";
      img.style.borderRadius = "8px";
      img.style.display = "block";
      img.style.margin = "16px 0";
      modal.appendChild(img);
    } else if (type === "flashcard") {
      const cardDiv = document.createElement("div");
      cardDiv.style.background = "#f8f9fa";
      cardDiv.style.padding = "20px";
      cardDiv.style.borderRadius = "8px";
      cardDiv.style.marginBottom = "16px";
      cardDiv.style.minHeight = "150px";
      cardDiv.style.display = "flex";
      cardDiv.style.alignItems = "center";
      cardDiv.style.justifyContent = "center";
      cardDiv.style.textAlign = "center";
      cardDiv.innerHTML = content;
      cardDiv.style.fontSize = "16px";
      cardDiv.style.lineHeight = "1.6";
      cardDiv.style.color = "#333";
      modal.appendChild(cardDiv);
    }

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Close";
    closeBtn.style.marginTop = "16px";
    closeBtn.style.padding = "10px 20px";
    closeBtn.style.background = "#dc3545";
    closeBtn.style.color = "white";
    closeBtn.style.border = "none";
    closeBtn.style.borderRadius = "6px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.style.fontWeight = "500";
    closeBtn.style.width = "100%";
    closeBtn.style.transition = "background 0.2s";
    closeBtn.onmouseover = () => (closeBtn.style.background = "#c82333");
    closeBtn.onmouseout = () => (closeBtn.style.background = "#dc3545");
    closeBtn.onclick = () => {
      backdrop.remove();
    };
    modal.appendChild(closeBtn);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  } catch (e) {
    console.error("[ContentScript] Error displaying media modal:", e);
  }
}

if (
  window.chrome &&
  chrome.runtime &&
  chrome.runtime.onMessage &&
  chrome.runtime.onMessage.addListener
) {
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      try {
        if (
          msg.type === "engagementUpdate" ||
          msg.payload?.classScore !== undefined
        ) {
          const val = msg.payload ? msg.payload.classScore : msg.classScore;
          updateGauge(val);
        }
        // Start competitive quiz on student tabs
        if (msg.type === "startCompetitiveQuiz" && msg.payload) {
          try {
            showCompetitiveQuiz(msg.payload);
          } catch (e) {}
        }
        // Student receives quiz result
        if (msg.type === "quizResult" && msg.payload) {
          try {
            showQuizOutcome(msg.payload);
          } catch (e) {}
        }
        // Teacher / all tabs can receive finished event to display results
        if (msg.type === "competitiveQuizFinished" && msg.payload) {
          try {
            showCompetitiveSummary(msg.payload);
          } catch (e) {}
        }
        // GIF generation result
        if (msg.type === "gifResult" && msg.payload) {
          try {
            console.log("[ContentScript] GIF result received:", msg.payload);
            if (msg.payload.gifUrl) {
              console.log(
                "[ContentScript] GIF URL available:",
                msg.payload.gifUrl
              );
              // Display GIF in modal
              displayMediaModal(
                "gif",
                "🎬 GIF: " + msg.payload.topic,
                msg.payload.gifUrl
              );
            } else if (msg.payload.error) {
              console.warn("[ContentScript] GIF error:", msg.payload.error);
              try {
                showTempMessage("❌ GIF error: " + msg.payload.error);
              } catch (e) {
                console.warn(
                  "[ContentScript] Could not show temp message:",
                  e.message
                );
              }
            } else {
              console.warn(
                "[ContentScript] No GIF URL in response",
                msg.payload
              );
              try {
                showTempMessage("❌ No GIF found for: " + msg.payload.topic);
              } catch (e) {
                console.warn(
                  "[ContentScript] Could not show temp message:",
                  e.message
                );
              }
            }
          } catch (e) {
            console.error("[ContentScript] Error processing GIF result:", e);
          }
        }
        // Flashcard generation result
        if (msg.type === "flashcardResult" && msg.payload) {
          try {
            console.log(
              "[ContentScript] Flashcard result received:",
              msg.payload
            );
            if (msg.payload.flashcard) {
              console.log(
                "[ContentScript] Flashcard available:",
                msg.payload.flashcard
              );
              // Convert flashcard to HTML and display in modal
              let cardHTML = "";
              const flashcard = msg.payload.flashcard;
              if (typeof flashcard === "string") {
                cardHTML = flashcard;
              } else if (typeof flashcard === "object") {
                cardHTML = `
                  <div>
                    <div style="margin-bottom: 12px;"><strong>Q: ${
                      flashcard.question || flashcard.front || ""
                    }</strong></div>
                    <div style="margin-bottom: 12px;"><strong>A: ${
                      flashcard.answer || flashcard.back || ""
                    }</strong></div>
                    ${
                      flashcard.explanation
                        ? `<div style="font-style: italic; font-size: 14px; color: #555;">${flashcard.explanation}</div>`
                        : ""
                    }
                  </div>
                `;
              }
              displayMediaModal(
                "flashcard",
                "📇 Flashcard: " + msg.payload.topic,
                cardHTML
              );
            } else if (msg.payload.error) {
              console.warn(
                "[ContentScript] Flashcard error:",
                msg.payload.error
              );
              try {
                showTempMessage("❌ Flashcard error: " + msg.payload.error);
              } catch (e) {
                console.warn(
                  "[ContentScript] Could not show temp message:",
                  e.message
                );
              }
            } else {
              console.warn(
                "[ContentScript] No flashcard in response",
                msg.payload
              );
              try {
                showTempMessage(
                  "❌ Failed to create flashcard for: " + msg.payload.topic
                );
              } catch (e) {
                console.warn(
                  "[ContentScript] Could not show temp message:",
                  e.message
                );
              }
            }
          } catch (e) {
            console.error(
              "[ContentScript] Error processing flashcard result:",
              e
            );
          }
        }
      } catch (e) {
        console.warn("onMessage handler error", e && e.message);
      }
    });
  } catch (e) {
    console.warn("failed to register onMessage listener", e && e.message);
  }
}

function updateGauge(val) {
  try {
    if (typeof val !== "number" || val < 0 || val > 1) return;

    const percent = Math.round(val * 100);
    const label = val > 0.75 ? "Engaged" : val > 0.45 ? "Okay" : "Low";

    const valueEl = document.getElementById("engagement-value");
    const labelEl = document.getElementById("engagement-label");
    const gaugeEl = document.getElementById("engagement-gauge");

    if (!valueEl || !labelEl || !gaugeEl) return; // UI not present

    valueEl.innerText = percent + "%";
    labelEl.innerText = label;
    gaugeEl.style.border =
      val > 0.75
        ? "2px solid #2ecc71"
        : val > 0.45
        ? "2px solid #f1c40f"
        : "2px solid #e74c3c";
  } catch (e) {
    console.error("updateGauge error", e);
  }
}

// Speedometer helpers and polling for teacher view
let speedometerInterval = null;
let alertShowing = false;

function showAlertBanner() {
  const b = document.getElementById("cb-alert-banner");
  if (!b) return;
  b.classList.add("show");
  alertShowing = true;
}

function hideAlertBanner() {
  const b = document.getElementById("cb-alert-banner");
  if (!b) return;
  b.classList.remove("show");
  alertShowing = false;
}

function setNeedlePercent(val) {
  try {
    if (typeof val !== "number" || val < 0 || val > 1) return;

    // val: 0..1
    const degMin = -90; // left
    const degMax = 90; // right
    const deg = degMin + (degMax - degMin) * val;
    const needle = document.getElementById("needle");
    if (needle) {
      needle.style.transform = `translate(0,0) rotate(${deg}deg)`;
    }
    const p = document.getElementById("spd-percent");
    const lbl = document.getElementById("spd-label");
    if (p) p.textContent = Math.round(val * 100) + "%";
    if (lbl)
      lbl.textContent = val > 0.75 ? "Engaged" : val > 0.45 ? "Okay" : "Low";
  } catch (e) {
    console.error("setNeedlePercent error", e);
  }
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
    if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage)
      return;
    chrome.runtime.sendMessage({ type: "getClassScore" }, (resp) => {
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
  } catch (e) {}
}

// Start polling when overlay is created
startTeacherPolling();

// clear polling on unload
window.addEventListener("beforeunload", () => stopTeacherPolling());

// Competitive quiz UI for students
function showCompetitiveQuiz(quiz) {
  // remove any existing
  removeCompetitiveQuiz();
  const modal = document.createElement("div");
  modal.id = "cb-competitive-quiz";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.zIndex = 2147483651;

  const card = document.createElement("div");
  card.style.background = "#0f0f10";
  card.style.color = "#f3e9d2";
  card.style.padding = "16px";
  card.style.borderRadius = "10px";
  card.style.width = "360px";
  card.style.textAlign = "center";

  const q = document.createElement("div");
  q.textContent = quiz.question || "Question";
  q.style.marginBottom = "12px";
  q.style.fontWeight = "600";

  const opts = document.createElement("div");
  opts.style.display = "flex";
  opts.style.flexDirection = "column";
  opts.style.gap = "8px";

  quiz.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.textContent = opt;
    b.className = "cb-btn";
    b.style.width = "100%";
    b.addEventListener("click", () => {
      submitQuizAnswer(quiz.quizId, idx);
      // disable buttons
      Array.from(opts.querySelectorAll("button")).forEach(
        (bt) => (bt.disabled = true)
      );
      b.style.opacity = "0.8";
    });
    opts.appendChild(b);
  });

  const timer = document.createElement("div");
  timer.style.marginTop = "10px";
  timer.style.fontSize = "13px";
  timer.id = "cb-quiz-timer";
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
      try {
        removeCompetitiveQuiz();
      } catch (e) {}
      return;
    }
    if (document.getElementById("cb-quiz-timer"))
      document.getElementById(
        "cb-quiz-timer"
      ).textContent = `Time left: ${remaining}s`;
  }, 1000);
}

function removeCompetitiveQuiz() {
  const ex = document.getElementById("cb-competitive-quiz");
  if (ex)
    try {
      ex.remove();
    } catch (e) {}
}

function submitQuizAnswer(quizId, selectedIndex) {
  try {
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          type: "quizAnswer",
          payload: { quizId, selectedIndex, ts: Date.now() },
        },
        (resp) => {}
      );
    }
  } catch (e) {}
}

function showQuizOutcome(payload) {
  // show a small toast informing student whether they won or were correct
  const yourCorrect = payload.yourCorrect;
  removeCompetitiveQuiz();

  const text = yourCorrect
    ? "You answered correctly!"
    : "You answered incorrectly.";

  showTempMessage(text, 4000);
}

function showCompetitiveSummary(payload) {
  // show teacher and others the summary briefly
  const winner = payload.winner || "Unknown";
  const results = payload.results || [];

  const msg = winner
    ? `🏆 Competitive quiz finished. Winner: ${winner}`
    : "Competitive quiz finished: no winner";

  try {
    // Try to show via toast if available, otherwise log
    if (typeof showTempMessage === "function") {
      showTempMessage(msg, 5000);
    } else {
      console.log(msg);
    }
  } catch (e) {
    console.log(msg);
  }
}

// ===== GIF Modal Display =====
function removeGifModal() {
  const ex = document.getElementById("cb-gif-modal");
  if (ex)
    try {
      ex.remove();
    } catch (e) {}
}

function showGifModal(payload) {
  removeGifModal();
  const { gifUrl, topic, error } = payload;

  if (error) {
    try {
      showTempMessage("GIF not found for: " + topic, 4000);
    } catch (e) {
      console.error("[GIF Modal] Error showing temp message:", e);
      alert("GIF not found for: " + topic);
    }
    return;
  }

  const modal = document.createElement("div");
  modal.id = "cb-gif-modal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.7)";
  modal.style.zIndex = "2147483651";

  const card = document.createElement("div");
  card.style.background = "#0f0f10";
  card.style.color = "#f3e9d2";
  card.style.padding = "20px";
  card.style.borderRadius = "10px";
  card.style.width = "500px";
  card.style.maxWidth = "90vw";
  card.style.textAlign = "center";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.6)";

  const title = document.createElement("h3");
  title.textContent = "GIF: " + topic;
  title.style.marginBottom = "12px";
  title.style.color = "#f3e9d2";

  const img = document.createElement("img");
  img.src = gifUrl;
  img.style.width = "100%";
  img.style.borderRadius = "8px";
  img.style.marginBottom = "12px";
  img.style.maxHeight = "400px";
  img.style.objectFit = "contain";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "cb-btn";
  closeBtn.style.width = "100%";
  closeBtn.addEventListener("click", removeGifModal);

  card.appendChild(title);
  card.appendChild(img);
  card.appendChild(closeBtn);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // Click outside modal to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) removeGifModal();
  });
}

// ===== Flashcard Modal Display =====
function removeFlashcardModal() {
  const ex = document.getElementById("cb-flashcard-modal");
  if (ex)
    try {
      ex.remove();
    } catch (e) {}
}

function showFlashcardModal(payload) {
  removeFlashcardModal();
  const { flashcard, topic, error } = payload;

  if (error || !flashcard) {
    try {
      showTempMessage(
        "Flashcard generation failed: " + (error || "Unknown error"),
        4000
      );
    } catch (e) {
      console.error("[Flashcard Modal] Error showing temp message:", e);
      // Fallback: display error message directly
      const errMsg = document.createElement("div");
      errMsg.style.position = "fixed";
      errMsg.style.bottom = "22px";
      errMsg.style.left = "50%";
      errMsg.style.transform = "translateX(-50%)";
      errMsg.style.background = "rgba(0,0,0,0.85)";
      errMsg.style.color = "#f3e9d2";
      errMsg.style.padding = "8px 12px";
      errMsg.style.borderRadius = "8px";
      errMsg.style.zIndex = "2147483650";
      errMsg.textContent =
        "Flashcard generation failed: " + (error || "Unknown error");
      document.body.appendChild(errMsg);
      setTimeout(() => {
        try {
          errMsg.remove();
        } catch (e) {}
      }, 4000);
    }
    return;
  }

  const modal = document.createElement("div");
  modal.id = "cb-flashcard-modal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.7)";
  modal.style.zIndex = "2147483651";

  const card = document.createElement("div");
  card.style.background = "#0f0f10";
  card.style.color = "#f3e9d2";
  card.style.padding = "30px";
  card.style.borderRadius = "10px";
  card.style.width = "500px";
  card.style.maxWidth = "90vw";
  card.style.textAlign = "center";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.6)";

  const title = document.createElement("h3");
  title.textContent = "Flashcard: " + topic;
  title.style.marginBottom = "20px";
  title.style.color = "#f3e9d2";
  title.style.fontSize = "18px";

  const flashcardContainer = document.createElement("div");
  flashcardContainer.style.perspective = "1000px";
  flashcardContainer.style.minHeight = "200px";

  const flashcardFace = document.createElement("div");
  flashcardFace.id = "cb-flashcard-face";
  flashcardFace.style.position = "relative";
  flashcardFace.style.width = "100%";
  flashcardFace.style.height = "200px";
  flashcardFace.style.background =
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  flashcardFace.style.borderRadius = "8px";
  flashcardFace.style.display = "flex";
  flashcardFace.style.alignItems = "center";
  flashcardFace.style.justifyContent = "center";
  flashcardFace.style.cursor = "pointer";
  flashcardFace.style.padding = "20px";
  flashcardFace.style.boxSizing = "border-box";
  flashcardFace.style.transition = "all 0.3s ease";
  flashcardFace.style.fontSize = "16px";
  flashcardFace.style.fontWeight = "600";
  flashcardFace.style.textAlign = "center";
  flashcardFace.innerHTML = flashcard.front;

  let isFlipped = false;
  flashcardFace.addEventListener("click", () => {
    isFlipped = !isFlipped;
    if (isFlipped) {
      flashcardFace.style.background =
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
      flashcardFace.innerHTML = flashcard.back;
      flipBtn.textContent = "Show Question";
    } else {
      flashcardFace.style.background =
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      flashcardFace.innerHTML = flashcard.front;
      flipBtn.textContent = "Show Answer";
    }
  });

  flashcardContainer.appendChild(flashcardFace);

  const difficultyTag = document.createElement("div");
  difficultyTag.style.marginTop = "15px";
  difficultyTag.style.fontSize = "12px";
  difficultyTag.style.padding = "5px 10px";
  difficultyTag.style.background =
    flashcard.difficulty === "easy"
      ? "#2ecc71"
      : flashcard.difficulty === "hard"
      ? "#e74c3c"
      : "#f39c12";
  difficultyTag.style.color = "#0f0f10";
  difficultyTag.style.borderRadius = "4px";
  difficultyTag.style.display = "inline-block";
  difficultyTag.style.fontWeight = "bold";
  difficultyTag.textContent =
    "Difficulty: " + (flashcard.difficulty || "medium").toUpperCase();

  const buttonsDiv = document.createElement("div");
  buttonsDiv.style.display = "flex";
  buttonsDiv.style.gap = "8px";
  buttonsDiv.style.justifyContent = "center";
  buttonsDiv.style.marginTop = "20px";

  const flipBtn = document.createElement("button");
  flipBtn.textContent = "Show Answer";
  flipBtn.className = "cb-btn";
  flipBtn.style.flex = "1";
  flipBtn.addEventListener("click", () => flashcardFace.click());

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "cb-btn";
  closeBtn.style.flex = "1";
  closeBtn.addEventListener("click", removeFlashcardModal);

  buttonsDiv.appendChild(flipBtn);
  buttonsDiv.appendChild(closeBtn);

  card.appendChild(title);
  card.appendChild(flashcardContainer);
  card.appendChild(difficultyTag);
  card.appendChild(buttonsDiv);
  modal.appendChild(card);
  document.body.appendChild(modal);

  // Click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) removeFlashcardModal();
  });
}
