const setTopicBtn = document.getElementById('set-topic');
const triggerQuizBtn = document.getElementById('trigger-quiz');
const status = document.getElementById('status');


setTopicBtn.addEventListener('click', async () => {
const topic = document.getElementById('topic').value;
await chrome.storage.local.set({ currentTopic: topic });
status.innerText = `Topic set: ${topic}`;
// notify content script in active Meet tab
const tabs = await chrome.tabs.query({ url: '*://meet.google.com/*' });
if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'topicSet', topic });
});


triggerQuizBtn.addEventListener('click', async () => {
// ask background to notify backend to create a quiz
chrome.runtime.sendMessage({ type: 'trigger_quiz' }, (resp) => {
status.innerText = 'Quiz requested';
});
});