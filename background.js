// background.js - POST approach (no socket.io)
console.log('background (POST) running');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'engagementSnapshot') {
    fetch('http://localhost:3000/api/snapshot', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ snapshot: msg.snapshot })
    }).then(r => r.json()).then(data => sendResponse({ ok: true })).catch(err => {
      console.error('POST snapshot failed', err);
      sendResponse({ ok: false, error: err.message });
    });
    return true; // keep sendResponse alive
  }
  // Respond to requests for the current class score by querying the local server
  if (msg.type === 'getClassScore') {
    fetch('http://localhost:3000/api/classScore').then(r => r.json()).then(data => {
      sendResponse({ ok: true, data });
    }).catch(err => {
      console.error('GET classScore failed', err);
      sendResponse({ ok: false, error: err.message });
    });
    return true; // keep sendResponse alive
  }

  // Allow broadcasting an engagementUpdate to all tabs (forward from one tab)
  if (msg.type === 'engagementUpdate' && msg.payload) {
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(t => {
          try {
            chrome.tabs.sendMessage(t.id, { type: 'engagementUpdate', payload: msg.payload });
          } catch (e) { }
        });
      });
    } catch (e) { }
    sendResponse({ ok: true });
    return false;
  }

  // background.js - POST approach (no socket.io)
  console.log('background (POST) running');

});
