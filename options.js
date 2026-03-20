/**
 * 划词翻译 - 设置页面脚本
 */

document.addEventListener('DOMContentLoaded', function() {
  // 加载保存的设置
  loadSettings();

  // 保存按钮点击事件
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});

// 默认配置
const defaultConfig = {
  targetLang: 'zh',
  sourceLang: 'auto',
  triggerMode: 'auto',
  showIcon: true,
  autoPlay: false,
  theme: 'light'
};

/**
 * 加载设置
 */
function loadSettings() {
  chrome.storage.sync.get(defaultConfig, function(result) {
    // 语言设置
    document.getElementById('targetLang').value = result.targetLang;
    document.getElementById('sourceLang').value = result.sourceLang;

    // 触发方式
    const triggerModeRadios = document.querySelectorAll('input[name="triggerMode"]');
    triggerModeRadios.forEach(radio => {
      radio.checked = radio.value === result.triggerMode;
    });

    // 其他选项
    document.getElementById('showIcon').checked = result.showIcon;
    document.getElementById('autoPlay').checked = result.autoPlay;

    // 主题
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
      radio.checked = radio.value === result.theme;
    });
  });
}

/**
 * 保存设置
 */
function saveSettings() {
  const settings = {
    targetLang: document.getElementById('targetLang').value,
    sourceLang: document.getElementById('sourceLang').value,
    triggerMode: document.querySelector('input[name="triggerMode"]:checked').value,
    showIcon: document.getElementById('showIcon').checked,
    autoPlay: document.getElementById('autoPlay').checked,
    theme: document.querySelector('input[name="theme"]:checked').value
  };

  chrome.storage.sync.set(settings, function() {
    showToast('设置已保存');
  });
}

/**
 * 显示提示
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
