// background.js


// Background/service worker is minimal for this starter.
// You can expand this with Socket.IO or other realtime connections later.


self.addEventListener('install', (event) => {
console.log('ClassBoost background installed');
});


self.addEventListener('activate', (event) => {
console.log('ClassBoost background activated');
});


// Listen to runtime messages from content script if needed
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
console.log('background received', msg);
if (msg && msg.type === 'ping') sendResponse({ ok: true });
});

async function getGoogleToken(interactive = true) {
return new Promise((resolve, reject) => {
chrome.identity.getAuthToken({ interactive }, (token) => {
if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
resolve(token);
});
});
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg.type === 'get_token') {
getGoogleToken().then(token => sendResponse({ token })).catch(err => sendResponse({ error: err.message }));
return true; // keep channel open
}
});