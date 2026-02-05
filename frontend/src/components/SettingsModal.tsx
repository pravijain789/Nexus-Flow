import React, { useState } from "react";
import { X, Save } from "lucide-react";

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: any) {
  const [data, setData] = useState(
    initialData || { name: "My Workflow", spreadsheetId: "" },
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800">Workflow Settings</h2>
          <button onClick={onClose}>
            <X size={20} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Workflow Name
            </label>
            <input
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Google Sheet ID
            </label>
            <input
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="1BxiMVs0XRA5nFMd..."
              value={data.spreadsheetId}
              onChange={(e) =>
                setData({ ...data, spreadsheetId: e.target.value })
              }
            />
            <p className="text-[10px] text-slate-400">
              Required for Sheet Read/Update nodes.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => onSave(data)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save size={16} /> Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
