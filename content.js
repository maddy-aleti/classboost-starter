// content.js
(function() {
const OVERLAY_ID = 'classboost-overlay';


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
document.getElementById('cb-close-modal').addEventListener('click', () => {
document.getElementById('cb-modal').style.display = 'none';
});
}


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
})();