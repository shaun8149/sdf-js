// Shared WebGL2 availability gate for Atlas Present entry points.
// The studio renderer requires WebGL2; callers decide whether to throw or
// simply stop booting after the notice is shown.

const NOTICE_HTML =
  '<div style="max-width:560px;padding:0 28px;text-align:center;font:400 15px/1.7 system-ui,sans-serif;color:#dce6f5">' +
  '<div style="font:600 22px/1.3 system-ui,sans-serif;letter-spacing:.3em;margin-bottom:18px">ATLAS·PRESENT</div>' +
  '这个演示需要 WebGL2, 当前浏览器/设备不支持。<br/>' +
  'This demo needs WebGL2, which this browser does not provide.<br/><br/>' +
  '请在<b>电脑上的 Chrome / Edge / Firefox</b> 打开这条链接。<br/>' +
  'Open this link in desktop Chrome, Edge or Firefox.</div>';

export function hasWebGL2(createCanvas = () => document.createElement('canvas')) {
  try {
    const canvas = createCanvas();
    return !!canvas?.getContext?.('webgl2');
  } catch {
    return false;
  }
}

export function showWebGL2Notice(loadingEl) {
  if (!loadingEl) return false;
  loadingEl.innerHTML = NOTICE_HTML;
  loadingEl.classList?.remove?.('done');
  if (loadingEl.style) {
    loadingEl.style.opacity = '1';
    loadingEl.style.pointerEvents = 'auto';
  }
  return true;
}

export function requireWebGL2OrNotice({ loadingEl, createCanvas } = {}) {
  if (hasWebGL2(createCanvas)) return true;
  showWebGL2Notice(loadingEl);
  return false;
}
