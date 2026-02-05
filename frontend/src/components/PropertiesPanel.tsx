import React, { useState, useRef, useEffect } from "react";
import { X, Settings, Braces, ChevronRight, Variable } from "lucide-react";
import { NODE_TYPES, CATEGORY_COLORS } from "@/lib/nodeConfig";

// --- SYSTEM VARIABLES (Always available) ---
const SYSTEM_VARS = [
  { name: "TX_HASH", desc: "Transaction Hash from previous step" },
  { name: "ROW_INDEX", desc: "Current Row Number in Sheet" },
  { name: "HTTP_RESPONSE", desc: "Result from HTTP Request" },
];

export default function PropertiesPanel({
  selectedNode,
  updateData,
  onClose,
  globalSettings,
}: any) {
  const type = selectedNode.data.type;
  const config = NODE_TYPES[type] || NODE_TYPES["math_operation"] || {};
  const colors = CATEGORY_COLORS[config.category] || CATEGORY_COLORS.logic;
  const currentData = selectedNode.data.config || {};

  const [activeField, setActiveField] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveField(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (field: string, value: any) => {
    updateData(selectedNode.id, { [field]: value });
  };

  const insertVariable = (field: string, varName: string) => {
    const currentValue = currentData[field] || "";
    const newValue = `${currentValue}{{${varName}}}`;
    handleChange(field, newValue);
    setActiveField(null);
  };

  const getAvailableVariables = () => {
    const vars = [];
    if (globalSettings?.columnMapping) {
      Object.entries(globalSettings.columnMapping).forEach(([col, name]) => {
        vars.push({
          name: name as string,
          desc: `Mapped from Column ${String.fromCharCode(65 + Number(col))}`,
        });
      });
    }
    if (vars.length === 0) {
      vars.push({ name: "Column_A", desc: "Raw Column A" });
      vars.push({ name: "Column_B", desc: "Raw Column B" });
    }
    return [...vars, ...SYSTEM_VARS];
  };

  const variables = getAvailableVariables();

  return (
    <div className="w-96 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            {React.createElement(config.icon, {
              size: 18,
              className: colors.text,
            })}
          </div>
          <div>
            <h2 className="font-bold text-slate-800">{config.label}</h2>
            <p className="text-xs text-slate-400 font-mono">
              {selectedNode.data.label}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Form Fields */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Settings size={14} /> Configuration
          </h3>

          {config.inputs &&
            config.inputs.map((input: any) => (
              <div key={input.name} className="space-y-1.5 relative group">
                <div className="flex justify-between">
                  <label className="text-sm font-bold text-slate-700">
                    {input.label}
                  </label>
                  {input.required === false && (
                    <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 rounded">
                      Optional
                    </span>
                  )}
                </div>

                {input.type === "select" ? (
                  <select
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
                    value={currentData[input.name] || ""}
                    onChange={(e) => handleChange(input.name, e.target.value)}
                  >
                    <option value="" disabled>
                      Select an option
                    </option>
                    {input.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    {/* Input Field */}
                    {input.type === "textarea" ? (
                      <textarea
                        // Added pr-10 to prevent text from going under the button
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg text-sm text-slate-900 h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none shadow-sm placeholder:text-slate-400 font-mono leading-relaxed"
                        placeholder={input.placeholder || ""}
                        value={currentData[input.name] || ""}
                        onChange={(e) =>
                          handleChange(input.name, e.target.value)
                        }
                      />
                    ) : (
                      <input
                        type={input.type}
                        // Added pr-10 here as well
                        className="w-full p-2.5 pr-10 bg-white border border-gray-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400 font-mono"
                        placeholder={input.placeholder || ""}
                        value={currentData[input.name] || ""}
                        readOnly={input.readOnly}
                        onChange={(e) =>
                          handleChange(input.name, e.target.value)
                        }
                      />
                    )}

                    {/* --- IMPROVED VARIABLE BUTTON --- */}
                    {!input.readOnly &&
                      (input.type === "text" || input.type === "textarea") && (
                        <button
                          onClick={() =>
                            setActiveField(
                              activeField === input.name ? null : input.name,
                            )
                          }
                          // Dynamic Positioning based on input type
                          className={`
                            absolute right-2 
                            ${input.type === "textarea" ? "top-2" : "top-1/2 -translate-y-1/2"}
                            p-1.5 rounded-md border shadow-sm transition-all duration-200 group/btn
                            flex items-center gap-1
                            ${
                              activeField === input.name
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-indigo-100"
                                : "bg-white border-gray-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md"
                            }
                          `}
                          title="Insert Variable"
                        >
                          <Variable size={14} strokeWidth={2.5} />
                          {/* Optional Tooltip/Text on Hover */}
                          <span
                            className={`text-[9px] font-bold ${activeField === input.name ? "block" : "hidden group-hover/btn:block"}`}
                          >
                            VAR
                          </span>
                        </button>
                      )}

                    {/* Dropdown Menu */}
                    {activeField === input.name && (
                      <div
                        ref={dropdownRef}
                        className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5"
                      >
                        <div className="bg-slate-50/80 backdrop-blur-sm px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                          <Braces size={12} className="text-indigo-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Available Variables
                          </span>
                        </div>

                        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                          {variables.map((v) => (
                            <button
                              key={v.name}
                              onClick={() => insertVariable(input.name, v.name)}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-50 flex items-center justify-between group/item transition-all duration-150 border border-transparent hover:border-indigo-100"
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] group-hover/item:bg-white group-hover/item:text-indigo-600 transition-colors">
                                    {v.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 pl-0.5 truncate max-w-[180px]">
                                  {v.desc}
                                </span>
                              </div>
                              <ChevronRight
                                size={14}
                                className="text-slate-300 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all duration-200"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {(!config.inputs || config.inputs.length === 0) && (
            <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-100">
              <p className="text-sm text-slate-400 font-medium">
                No configuration needed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
