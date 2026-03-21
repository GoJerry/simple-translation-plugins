document.addEventListener('DOMContentLoaded', function() {
  const defaults = {
    targetLang: 'zh', sourceLang: 'auto', triggerMode: 'auto',
    showIcon: true, autoPlay: false, theme: 'light',
    translationEngine: 'google', enableHistory: true,
    enableHover: true, hoverDelay: 300
  };

  function loadSettings() {
    chrome.storage.sync.get(defaults, function(result) {
      document.getElementById('targetLang').value = result.targetLang;
      document.getElementById('sourceLang').value = result.sourceLang;
      document.getElementById('translationEngine').value = result.translationEngine;
      document.getElementById('showIcon').checked = result.showIcon;
      document.getElementById('autoPlay').checked = result.autoPlay;
      document.getElementById('enableHistory').checked = result.enableHistory;
      document.getElementById('enableHover').checked = result.enableHover;
      document.getElementById('hoverDelay').value = result.hoverDelay;

      document.querySelectorAll('input[name="triggerMode"]').forEach(r => { r.checked = r.value === result.triggerMode; });
      document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === result.theme; });
    });
  }

  function saveSettings() {
    const settings = {
      targetLang: document.getElementById('targetLang').value,
      sourceLang: document.getElementById('sourceLang').value,
      translationEngine: document.getElementById('translationEngine').value,
      triggerMode: document.querySelector('input[name="triggerMode"]:checked').value,
      theme: document.querySelector('input[name="theme"]:checked').value,
      showIcon: document.getElementById('showIcon').checked,
      autoPlay: document.getElementById('autoPlay').checked,
      enableHistory: document.getElementById('enableHistory').checked,
      enableHover: document.getElementById('enableHover').checked,
      hoverDelay: parseInt(document.getElementById('hoverDelay').value) || 300
    };
    chrome.storage.sync.set(settings, function() { showToast('设置已保存'); });
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  loadSettings();
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});
