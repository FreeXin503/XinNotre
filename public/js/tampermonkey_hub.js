// Tampermonkey Userscript & JWT Sync Token Management Center
export const TampermonkeyHub = {
  // Get current JWT sync token
  getToken() {
    return localStorage.getItem('xinnote_token') || '';
  },

  // One-click copy helper
  async copyToClipboard(text, successCallback) {
    try {
      await navigator.clipboard.writeText(text);
      if (successCallback) successCallback();
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        if (successCallback) successCallback();
      } catch (copyErr) {
        alert('复制失败，请手动选择复制！');
      }
      document.body.removeChild(textarea);
    }
  },

  // Fetch userscript code
  async fetchUserscriptCode() {
    try {
      const res = await fetch('/oppo_notes_exporter.user.js');
      if (!res.ok) throw new Error('无法拉取脚本文件');
      return await res.text();
    } catch (err) {
      console.error('Fetch userscript failed:', err);
      return `// 抱歉，未能自动拉取脚本代码。\n// 您可以直接在本地目录中打开该文件进行复制：\n// 📂 OPPO便签导出系统/oppo_notes_exporter.user.js`;
    }
  }
};

window.TampermonkeyHub = TampermonkeyHub;
