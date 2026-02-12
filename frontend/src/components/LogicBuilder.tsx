import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  GitMerge,
  Braces,
  ChevronRight,
  Activity,
} from "lucide-react";

// --- TYPES ---
type Operator = ">" | "<" | "==" | "!=" | "contains" | "is_empty";
type LogicRule = { valueA: string; operator: Operator; valueB: string };
type RuleGroup = { combinator: "AND" | "OR"; rules: (LogicRule | RuleGroup)[] };

interface LogicBuilderProps {
  value: RuleGroup;
  onChange: (val: RuleGroup) => void;
  variables: any[];
}

// --- MAIN COMPONENT ---
export default function LogicBuilder({
  value,
  onChange,
  variables,
}: LogicBuilderProps) {
  // Initialization safety
  if (!value || !value.rules) {
    value = { combinator: "AND", rules: [] };
  }

  const updateGroup = (newGroup: RuleGroup) => onChange(newGroup);

  const addRule = () => {
    const newRules = [
      ...value.rules,
      { valueA: "", operator: "==", valueB: "" } as LogicRule,
    ];
    updateGroup({ ...value, rules: newRules });
  };

  const addGroup = () => {
    const newRules = [
      ...value.rules,
      { combinator: "AND", rules: [] } as RuleGroup,
    ];
    updateGroup({ ...value, rules: newRules });
  };

  const removeIndex = (index: number) => {
    const newRules = value.rules.filter((_, i) => i !== index);
    updateGroup({ ...value, rules: newRules });
  };

  const updateIndex = (index: number, item: LogicRule | RuleGroup) => {
    const newRules = [...value.rules];
    newRules[index] = item;
    updateGroup({ ...value, rules: newRules });
  };

  const toggleCombinator = () => {
    updateGroup({
      ...value,
      combinator: value.combinator === "AND" ? "OR" : "AND",
    });
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleCombinator}
          className={`px-3 py-1 text-xs font-bold rounded shadow-sm transition-all ${
            value.combinator === "AND"
              ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          }`}
        >
          {value.combinator}
        </button>
      </div>

      {/* Rules List */}
      <div className="flex flex-col gap-2 pl-3 border-l-2 border-slate-200/50 mt-1">
        {value.rules.map((rule, idx) => (
          <div key={idx} className="relative group">
            {"combinator" in rule ? (
              // Nested Group
              <div className="relative">
                <LogicBuilder
                  value={rule as RuleGroup}
                  onChange={(val) => updateIndex(idx, val)}
                  variables={variables}
                />
                <button
                  onClick={() => removeIndex(idx)}
                  className="absolute -right-2 -top-2 p-1 bg-white shadow-sm border rounded-full text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              // Single Rule Row
              <div className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded shadow-sm z-10 relative">
                {/* Variable A (With Picker) */}
                <VariableInput
                  value={(rule as LogicRule).valueA}
                  onChange={(v) =>
                    updateIndex(idx, { ...rule, valueA: v } as LogicRule)
                  }
                  variables={variables}
                  placeholder="Var A"
                />

                {/* Operator */}
                <select
                  className="text-xs bg-slate-50 border-none rounded font-bold text-slate-600 focus:ring-0 cursor-pointer w-16"
                  value={(rule as LogicRule).operator}
                  onChange={(e) =>
                    updateIndex(idx, {
                      ...rule,
                      operator: e.target.value as any,
                    } as LogicRule)
                  }
                >
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value="contains">has</option>
                  <option value="is_empty">empty</option>
                </select>

                {/* Value B (With Picker) */}
                <VariableInput
                  value={(rule as LogicRule).valueB}
                  onChange={(v) =>
                    updateIndex(idx, { ...rule, valueB: v } as LogicRule)
                  }
                  variables={variables}
                  placeholder="Value"
                />

                {/* Remove */}
                <button
                  onClick={() => removeIndex(idx)}
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Buttons */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={addRule}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
        >
          <Plus size={12} /> Rule
        </button>
        <button
          onClick={addGroup}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
        >
          <GitMerge size={12} /> Group
        </button>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: SMART INPUT WITH PICKER ---
const VariableInput = ({ value, onChange, variables, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insertVar = (varName: string, nodeId?: string) => {
    // Format: {{node_123.TX_HASH}} or {{Column_A}}
    const formatted = nodeId ? `{{${nodeId}.${varName}}}` : `{{${varName}}}`;

    // Append to existing text
    onChange(`${value}${formatted}`);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-[100px]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs p-1.5 pr-6 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none font-mono text-slate-700"
      />

      {/* The { } Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute right-0 top-1 p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
        title="Insert Variable"
      >
        <Braces size={12} />
      </button>

      {/* The Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] animate-in fade-in zoom-in-95 duration-100">
          <div className="bg-slate-50 px-2 py-1.5 border-b border-gray-100 text-[10px] font-bold text-slate-500 uppercase">
            Select Variable
          </div>
          {variables.length === 0 ? (
            <div className="p-3 text-center text-[10px] text-slate-400">
              No variables found
            </div>
          ) : (
            variables.map((v: any, idx: number) => (
              <button
                key={idx}
                onClick={() => insertVar(v.name, v.nodeId)}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-50 last:border-0 group"
              >
                <div
                  className={`p-1 rounded shrink-0 ${v.icon === "sheet" ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"}`}
                >
                  <Activity size={10} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-slate-700 font-mono truncate group-hover:text-indigo-700">
                    {v.name}
                  </span>
                  <span className="text-[9px] text-slate-400 truncate w-32">
                    {v.desc}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
