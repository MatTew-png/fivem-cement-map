import { useState, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { X, Download, Upload, Copy, Check, FileJson, Code2, RefreshCw, AlertCircle, Lock, Sparkles } from 'lucide-react';
import type { CementSpot } from '../types/map';
import {
  exportSpotsToJSON,
  parseImportedSpots,
  formatFiveMLuaTable,
} from '../utils/storage';
import {
  formatSpotsToEuclidJSON,
  formatSpotsToAstroRecord,
  formatSpotToVector3,
  copyToClipboard,
} from '../utils/spotExport';
import { CATEGORIES } from '../data/defaultSpots';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: CementSpot[];
  onImport: (importedSpots: CementSpot[]) => void;
  onResetDefault: () => void;
  isMaster?: boolean;
}

export const ExportImportModal = ({
  isOpen,
  onClose,
  spots,
  onImport,
  onResetDefault,
  isMaster = false,
}: ExportImportModalProps) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'lua' | 'euclid'>('euclid');
  const [euclidFormat, setEuclidFormat] = useState<'json' | 'astro' | 'vector3'>('json');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedEuclid, setCopiedEuclid] = useState(false);
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

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    spots.forEach((s) => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats);
  }, [spots]);

  const filteredSpots = useMemo(() => {
    if (selectedCategory === 'all') return spots;
    return spots.filter((s) => (s.category || 'other') === selectedCategory);
  }, [spots, selectedCategory]);

  const euclidPreviewContent = useMemo(() => {
    if (euclidFormat === 'json') {
      return formatSpotsToEuclidJSON(filteredSpots);
    }
    if (euclidFormat === 'astro') {
      return formatSpotsToAstroRecord(filteredSpots);
    }
    return filteredSpots.map((s) => `  ['${s.id}'] = ${formatSpotToVector3(s)}, -- ${s.name}`).join('\n');
  }, [filteredSpots, euclidFormat]);

  const handleCopyEuclid = async () => {
    await copyToClipboard(euclidPreviewContent);
    setCopiedEuclid(true);
    setTimeout(() => setCopiedEuclid(false), 2000);
  };

  const handleDownloadEuclid = () => {
    const filename = euclidFormat === 'json' ? 'fivemSpots.json' : euclidFormat === 'astro' ? 'spotsData.ts' : 'spots_coords.lua';
    const mimeType = euclidFormat === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([euclidPreviewContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        {/* NameThatUI Pattern: Segmented Control */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800">
          <div className="p-1 bg-slate-950 border border-slate-800 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab('euclid')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'euclid'
                  ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300 font-black'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>epic-euclid</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-slate-800 text-amber-400 shadow-sm border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก JSON</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-slate-800 text-amber-400 shadow-sm border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>นำเข้า</span>
            </button>
            <button
              onClick={() => setActiveTab('lua')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'lua'
                  ? 'bg-slate-800 text-amber-400 shadow-sm border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>FiveM Lua</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: epic-euclid Export */}
          {activeTab === 'euclid' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-300">
                    ส่งออกข้อมูลหมุดไปยังโปรเจกต์ epic-euclid
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    คัดลอกหรือดาวน์โหลดข้อมูลหมุดทั้งหมดเพื่อนำไปใช้อัปเดตแผนที่ใน <code>epic-euclid/src/data/fivemSpots.json</code> หรือ <code>epic-euclid/src/pages/map.astro</code> ได้ทันที
                  </p>
                </div>
              </div>

              {/* Format & Category Selection Controls */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEuclidFormat('json')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      euclidFormat === 'json'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    fivemSpots.json
                  </button>
                  <button
                    type="button"
                    onClick={() => setEuclidFormat('astro')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      euclidFormat === 'astro'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    spotsData (map.astro)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEuclidFormat('vector3')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      euclidFormat === 'vector3'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    vector3
                  </button>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-[11px] font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">หมวดหมู่ทั้งหมด ({spots.length} จุด)</option>
                  {uniqueCategories.map((catKey) => {
                    const info = CATEGORIES[catKey];
                    const catCount = spots.filter((s) => (s.category || 'other') === catKey).length;
                    return (
                      <option key={catKey} value={catKey}>
                        {info?.name || catKey} ({catCount})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEuclid}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer text-xs"
                >
                  {copiedEuclid ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEuclid ? 'คัดลอกลงคลิปบอร์ดแล้ว!' : `คัดลอกข้อมูล (${filteredSpots.length} จุด)`}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEuclid}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold border border-slate-700 transition-all cursor-pointer text-xs"
                  title="ดาวน์โหลดเป็นไฟล์"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์</span>
                </button>
              </div>

              {/* Preview */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mb-1">
                  <span>ตัวอย่างข้อมูลที่จะคัดลอก:</span>
                  <span className="font-mono text-amber-400/80">{filteredSpots.length} จุด</span>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed select-all">
                  {euclidPreviewContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                คุณมีหมุดทั้งหมด <strong className="text-amber-400">{spots.length}</strong> จุด
                สามารถคัดลอกหรือบันทึกเป็นไฟล์ JSON เพื่อนำไปใช้งานร่วมกันได้
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportSpotsToJSON(spots)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์ JSON (.json)</span>
                </button>
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  {copiedJSON ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedJSON ? 'คัดลอกเรียบร้อยแล้ว!' : 'คัดลอก JSON Text'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('euclid')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ส่งออกไป epic-euclid</span>
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
              {!isMaster ? (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2.5">
                  <div className="flex items-center gap-2 text-red-300 font-bold text-sm">
                    <Lock className="w-4 h-4 text-red-400" />
                    <span>ระบบป้องกันความปลอดภัย: สิทธิ์เฉพาะหัวหน้าแก๊ง</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    โค้ดตาราง FiveM Lua สำหรับ Server Script ถูกจำกัดสิทธิ์เฉพาะ <strong>Master PIN (หัวหน้าแก๊ง)</strong> เพื่อป้องกันการคัดลอกพิกัดแบบ Bulk Export
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">
                      โค้ดตาราง Lua สำหรับนำไปใส่ในสคริปต์ FiveM (เช่น <code>config.lua</code>):
                    </span>
                    <button
                      onClick={handleCopyLua}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all cursor-pointer"
                    >
                      {copiedLua ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLua ? 'Copied' : 'คัดลอกโค้ด Lua'}</span>
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                    {luaContent}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
