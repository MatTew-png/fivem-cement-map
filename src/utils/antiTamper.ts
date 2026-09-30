// ระบบป้องกันการแกะ/คัดลอกข้อมูลและเครื่องมือ DevTools (Anti-Tamper & Anti-Scraping)

export function setupAntiTamper(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. ปิด Context Menu (คลิกขวา)
  const handleContextMenu = (e: MouseEvent) => {
    // ปิดการคลิกขวาเพื่อป้องกัน Inspect Element
    e.preventDefault();
  };

  // 2. ดักจับและระงับปุ่มลัด DevTools
  const handleKeyDown = (e: KeyboardEvent) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+Shift+I / Cmd+Option+I (Inspect)
    // Ctrl+Shift+J / Cmd+Option+J (Console)
    // Ctrl+Shift+C / Cmd+Option+C (Inspect element)
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShiftOrAlt = e.shiftKey || e.altKey;

    if (isCtrlOrMeta && isShiftOrAlt && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+U / Cmd+U (View Page Source)
    if (isCtrlOrMeta && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Ctrl+S / Cmd+S (Save Page as HTML)
    if (isCtrlOrMeta && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  window.addEventListener('contextmenu', handleContextMenu, { capture: true });
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  // 3. เตือนใน Console
  try {
    console.log(
      '%c🔒 RUNTHUKVERB SECURITY GATE%c\nระบบนี้มีการเข้ารหัสและตรวจจับการเข้าถึงพิกัด ไม่อนุญาตให้คัดลอกหรือเผยแพร่',
      'color: #f59e0b; font-size: 20px; font-weight: 900; background: #0f172a; padding: 6px 12px; border-radius: 8px;',
      'color: #ef4444; font-size: 12px; font-weight: bold; margin-top: 4px;'
    );
  } catch {
    // Ignore
  }

  return () => {
    window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}
