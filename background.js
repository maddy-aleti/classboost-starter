// background.js - POST approach (no socket.io)
console.log("[Background] Script loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Background] Received message:", msg.type, msg);

  if (msg.type === "engagementSnapshot") {
    fetch("http://localhost:3000/api/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: msg.snapshot }),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("POST snapshot failed", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep sendResponse alive
  }
  // Respond to requests for the current class score by querying the local server
  if (msg.type === "getClassScore") {
    fetch("http://localhost:3000/api/classScore")
      .then((r) => r.json())
      .then((data) => {
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error("GET classScore failed", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep sendResponse alive
  }

  // Generate GIF from topic using Google Search API
  if (msg.type === "generateGif") {
    console.log(
      "[Background] generateGif handler triggered for topic:",
      msg.payload?.topic
    );
    try {
      const topic = (msg.payload && msg.payload.topic) || "educational content";
      console.log(
        "[Background] Fetching from http://localhost:3000/api/searchGif?topic=" +
          topic
      );

      fetch(
        `http://localhost:3000/api/searchGif?topic=${encodeURIComponent(topic)}`
      )
        .then((r) => {
          console.log("[Background] Fetch response status:", r.status);
          return r.json();
        })
        .then((data) => {
          console.log("[Background] Fetch response data:", data);
          if (data.ok && data.gifUrl) {
            console.log("[Background] GIF found, broadcasting to tabs...");
            // Broadcast GIF result to all tabs
            chrome.tabs.query({}, (tabs) => {
              console.log(
                "[Background] Found",
                tabs.length,
                "tabs to broadcast to"
              );
              tabs.forEach((t) => {
                try {
                  console.log("[Background] Sending gifResult to tab", t.id);
                  chrome.tabs.sendMessage(
                    t.id,
                    {
                      type: "gifResult",
                      payload: { gifUrl: data.gifUrl, topic, error: null },
                    },
                    () => {
                      // Ignore errors if tab is not ready
                      if (chrome.runtime.lastError) {
                        console.log(
                          "[Background] Tab not ready for message:",
                          chrome.runtime.lastError.message
                        );
                      }
                    }
                  );
                } catch (e) {
                  console.error("[Background] Error sending to tab:", e);
                }
              });
            });
            sendResponse({ ok: true, gifUrl: data.gifUrl });
          } else {
            console.log("[Background] No GIF found");
            // No GIF found
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach((t) => {
                try {
                  chrome.tabs.sendMessage(
                    t.id,
                    {
                      type: "gifResult",
                      payload: { gifUrl: null, topic, error: "GIF not found" },
                    },
                    () => {
                      if (chrome.runtime.lastError) {
                        console.log(
                          "[Background] Tab not ready for message:",
                          chrome.runtime.lastError.message
                        );
                      }
                    }
                  );
                } catch (e) {}
              });
            });
            sendResponse({ ok: false, error: "GIF not found" });
          }
        })
        .catch((err) => {
          console.error("[Background] generateGif fetch failed:", err);
          sendResponse({ ok: false, error: err.message });
        });
    } catch (e) {
      console.error("[Background] generateGif error:", e);
      sendResponse({ ok: false, error: e && e.message });
    }
    return true; // keep sendResponse alive
  }

  // Generate Flashcard from topic using Gemini API
  if (msg.type === "generateFlashcard") {
    console.log(
      "[Background] generateFlashcard handler triggered for topic:",
      msg.payload?.topic
    );
    try {
      const topic = (msg.payload && msg.payload.topic) || "educational content";
      console.log(
        "[Background] Fetching from http://localhost:3000/api/generateFlashcard?topic=" +
          topic
      );

      fetch(
        `http://localhost:3000/api/generateFlashcard?topic=${encodeURIComponent(
          topic
        )}`
      )
        .then((r) => {
          console.log("[Background] Fetch response status:", r.status);
          return r.json();
        })
        .then((data) => {
          console.log("[Background] Fetch response data:", data);
          if (data.ok && data.flashcard) {
            console.log(
              "[Background] Flashcard generated, broadcasting to tabs..."
            );
            // Broadcast flashcard result to all tabs
            chrome.tabs.query({}, (tabs) => {
              console.log(
                "[Background] Found",
                tabs.length,
                "tabs to broadcast to"
              );
              tabs.forEach((t) => {
                try {
                  console.log(
                    "[Background] Sending flashcardResult to tab",
                    t.id
                  );
                  chrome.tabs.sendMessage(
                    t.id,
                    {
                      type: "flashcardResult",
                      payload: {
                        flashcard: data.flashcard,
                        topic,
                        error: null,
                      },
                    },
                    () => {
                      if (chrome.runtime.lastError) {
                        console.log(
                          "[Background] Tab not ready for message:",
                          chrome.runtime.lastError.message
                        );
                      }
                    }
                  );
                } catch (e) {
                  console.error("[Background] Error sending to tab:", e);
                }
              });
            });
            sendResponse({ ok: true, flashcard: data.flashcard });
          } else {
            console.log("[Background] Flashcard generation failed");
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach((t) => {
                try {
                  chrome.tabs.sendMessage(
                    t.id,
                    {
                      type: "flashcardResult",
                      payload: {
                        flashcard: null,
                        topic,
                        error: data.error || "Flashcard generation failed",
                      },
                    },
                    () => {
                      if (chrome.runtime.lastError) {
                        console.log(
                          "[Background] Tab not ready for message:",
                          chrome.runtime.lastError.message
                        );
                      }
                    }
                  );
                } catch (e) {}
              });
            });
            sendResponse({ ok: false, error: "Flashcard generation failed" });
          }
        })
        .catch((err) => {
          console.error("[Background] generateFlashcard fetch failed:", err);
          sendResponse({ ok: false, error: err.message });
        });
    } catch (e) {
      console.error("[Background] generateFlashcard error:", e);
      sendResponse({ ok: false, error: e && e.message });
    }
    return true; // keep sendResponse alive
  }

  // Allow broadcasting an engagementUpdate to all tabs (forward from one tab)
  if (msg.type === "engagementUpdate" && msg.payload) {
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((t) => {
          try {
            chrome.tabs.sendMessage(
              t.id,
              { type: "engagementUpdate", payload: msg.payload },
              () => {
                if (chrome.runtime.lastError) {
                  // Ignore - tab may not be ready
                }
              }
            );
          } catch (e) {}
        });
      });
    } catch (e) {}
    sendResponse({ ok: true });
    return false;
  }

  // Match two students and trigger competitive quiz
  if (msg.type === "matchAndTriggerQuiz") {
    try {
      // find candidate tabs (http/https pages)
      chrome.tabs.query({}, (tabs) => {
        const candidates = tabs.filter(
          (t) => t.url && t.url.startsWith("http")
        );
        // exclude extension pages
        if (!candidates || candidates.length < 2) {
          sendResponse({ ok: false, error: "Not enough candidate tabs" });
          return;
        }
        // pick two random distinct tabs
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const [a, b] = [shuffled[0], shuffled[1]];

        // build a simple 60s quiz (single question for speed)
        const topic = (msg.payload && msg.payload.topic) || "General Topic";
        const quiz = {
          quizId: "quiz_" + Date.now(),
          duration: 60,
          topic: topic,
          question: 'Quick quiz: which is most related to "' + topic + '"?',
          options: ["Option A", "Option B", "Option C", "Option D"],
          answerIndex: 1, // placeholder correct answer (index 1)
        };

        // store state in-memory
        if (!globalThis.__classboost_quizzes)
          globalThis.__classboost_quizzes = {};
        globalThis.__classboost_quizzes[quiz.quizId] = {
          quiz,
          tabs: [a.id, b.id],
          answers: {},
        };

        // send quiz to both selected tabs
        [a.id, b.id].forEach((tabId) => {
          try {
            chrome.tabs.sendMessage(
              tabId,
              { type: "startCompetitiveQuiz", payload: quiz },
              () => {
                if (chrome.runtime.lastError) {
                  console.log("Tab not ready for quiz message");
                }
              }
            );
          } catch (e) {}
        });

        // notify teacher (sender) with selected tab ids
        sendResponse({ ok: true, selected: [a.id, b.id], quizId: quiz.quizId });

        // set timeout to evaluate after duration seconds
        setTimeout(() => {
          try {
            evaluateQuiz(quiz.quizId);
          } catch (e) {}
        }, quiz.duration * 1000 + 500);
      });
    } catch (e) {
      console.error("matchAndTriggerQuiz failed", e);
      sendResponse({ ok: false, error: e && e.message });
    }
    return true;
  }

  // Receive quiz answers from students
  if (msg.type === "quizAnswer" && msg.payload) {
    try {
      const { quizId, selectedIndex, ts } = msg.payload;
      const tabId =
        (sender && sender.tab && sender.tab.id) || msg.payload.tabId;
      const storage =
        globalThis.__classboost_quizzes &&
        globalThis.__classboost_quizzes[quizId];
      if (!storage) {
        sendResponse({ ok: false, error: "quiz not found" });
        return false;
      }
      storage.answers[tabId] = { selectedIndex, ts: ts || Date.now() };
      sendResponse({ ok: true });
      return false;
    } catch (e) {
      sendResponse({ ok: false, error: e && e.message });
      return false;
    }
  }

  // background.js - POST approach (no socket.io)
  console.log("background (POST) running");
});

// Evaluate quiz results and notify participants
function evaluateQuiz(quizId) {
  try {
    const storage =
      globalThis.__classboost_quizzes &&
      globalThis.__classboost_quizzes[quizId];
    if (!storage) return;
    const { quiz, tabs, answers } = storage;
    // compute correctness per tab
    const results = tabs.map((tabId) => {
      const a = answers[tabId];
      const correct = a && a.selectedIndex === quiz.answerIndex;
      const ts = a ? a.ts : null;
      return { tabId, correct, ts };
    });

    // determine winner
    let winner = null;
    const [r1, r2] = results;
    if (r1.correct && !r2.correct) winner = r1.tabId;
    else if (!r1.correct && r2.correct) winner = r2.tabId;
    else if (r1.correct && r2.correct) {
      if (r1.ts && r2.ts) winner = r1.ts <= r2.ts ? r1.tabId : r2.tabId;
    }

    // notify both students and teacher
    results.forEach((r) => {
      try {
        chrome.tabs.sendMessage(
          r.tabId,
          {
            type: "quizResult",
            payload: { quizId, yourCorrect: r.correct, winner, quiz },
          },
          () => {
            if (chrome.runtime.lastError) {
              console.log("Tab not ready for quiz result");
            }
          }
        );
      } catch (e) {}
    });

    // broadcast to teacher UI (all tabs)
    chrome.tabs.query({}, (tabsList) => {
      tabsList.forEach((t) => {
        try {
          chrome.tabs.sendMessage(
            t.id,
            {
              type: "competitiveQuizFinished",
              payload: { quizId, results, winner, quiz },
            },
            () => {
              if (chrome.runtime.lastError) {
                console.log("Tab not ready for quiz finished message");
              }
            }
          );
        } catch (e) {}
      });
    });

    // cleanup
    delete globalThis.__classboost_quizzes[quizId];
  } catch (e) {
    console.error("evaluateQuiz error", e);
  }
}
