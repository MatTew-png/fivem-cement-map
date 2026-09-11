import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { X, Download, Upload, Copy, Check, FileJson, Code2, RefreshCw, AlertCircle } from 'lucide-react';
import type { CementSpot } from '../types/map';
import {
  exportSpotsToJSON,
  parseImportedSpots,
  formatFiveMLuaTable,
} from '../utils/storage';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: CementSpot[];
  onImport: (importedSpots: CementSpot[]) => void;
  onResetDefault: () => void;
}

export const ExportImportModal = ({
  isOpen,
  onClose,
  spots,
  onImport,
  onResetDefault,
}: ExportImportModalProps) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'lua'>('export');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedLua, setCopiedLua] = useState(false);

  if (!isOpen) return null;

  const jsonContent = JSON.stringify(spots, null, 2);
  const luaContent = formatFiveMLuaTable(spots);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handleCopyLua = () => {
    navigator.clipboard.writeText(luaContent);
    setCopiedLua(true);
    setTimeout(() => setCopiedLua(false), 2000);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseImportedSpots(content);
        onImport(parsed);
        onClose();
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromText = () => {
    try {
      setImportError(null);
      const parsed = parseImportedSpots(importText);
      onImport(parsed);
      onClose();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแปลง JSON');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">จัดการและแชร์ข้อมูลหมุด</h2>
              <p className="text-xs text-slate-400">ส่งออก / นำเข้า หรือแปลงเป็นโค้ด FiveM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก (Export JSON)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>นำเข้า (Import)</span>
          </button>
          <button
            onClick={() => setActiveTab('lua')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'lua'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>FiveM Lua Table</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                คุณมีหมุดทั้งหมด <strong className="text-amber-400">{spots.length}</strong> จุด
                สามารถบันทึกเป็นไฟล์เพื่อส่งให้เพื่อนในแก๊งเปิดดูร่วมกันได้
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportSpotsToJSON(spots)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์ JSON (.json)</span>
                </button>
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all"
                >
                  {copiedJSON ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedJSON ? 'คัดลอกเรียบร้อยแล้ว!' : 'คัดลอก JSON Text'}</span>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-300 block">รีเซ็ตข้อมูลเริ่มต้น</span>
                  <span className="text-slate-500 text-[11px]">โหลดจุดปูนยอดนิยมดั้งเดิมของระบบ</span>
                </div>
                <button
                  onClick={() => {
                    if (confirm('คุณต้องการรีเซ็ตหมุดทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) {
                      onResetDefault();
                      onClose();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตค่าเริ่มต้น</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  1. อัปโหลดไฟล์ JSON (.json)
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-slate-950 hover:file:bg-amber-300 cursor-pointer"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-slate-900 px-2 text-slate-500 font-mono">หรือวางโค้ด JSON</span>
                </div>
              </div>

              <div>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="วางโค้ด JSON ที่ได้มาจากเพื่อนที่นี่..."
                  className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
                <button
                  disabled={!importText.trim()}
                  onClick={handleImportFromText}
                  className="mt-2 w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold transition-all shadow-md"
                >
                  นำเข้าข้อมูลหมุดจากข้อความ
                </button>
              </div>

              {importError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lua' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  โค้ดตาราง Lua สำหรับนำไปใส่ในสคริปต์ FiveM (เช่น <code>config.lua</code>):
                </span>
                <button
                  onClick={handleCopyLua}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all"
                >
                  {copiedLua ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLua ? 'Copied' : 'คัดลอกโค้ด Lua'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                {luaContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
