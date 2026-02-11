import React from "react";
import { Plus, Trash2, Copy, GitMerge, ChevronDown } from "lucide-react";

// Types must match your logic.ts
type Operator = ">" | "<" | "==" | "!=" | "contains" | "is_empty";
type LogicRule = { valueA: string; operator: Operator; valueB: string };
type RuleGroup = { combinator: "AND" | "OR"; rules: (LogicRule | RuleGroup)[] };

interface LogicBuilderProps {
  value: RuleGroup;
  onChange: (val: RuleGroup) => void;
  variables: any[]; // For the autocomplete dropdown
}

export default function LogicBuilder({
  value,
  onChange,
  variables,
}: LogicBuilderProps) {
  // Initialize if empty
  if (!value || !value.rules) {
    const initial: RuleGroup = { combinator: "AND", rules: [] };
    // We defer the update to avoid render-loop, or just render initial UI
    // Better to handle initialization in parent, but safety check here:
    value = initial;
  }

  const updateGroup = (newGroup: RuleGroup) => {
    onChange(newGroup);
  };

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
      {/* Header: Combinator Toggle */}
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
        <span className="text-xs text-slate-400">
          {value.combinator === "AND"
            ? "All must be true"
            : "At least one must be true"}
        </span>
      </div>

      {/* Rules List */}
      <div className="flex flex-col gap-2 pl-3 border-l-2 border-slate-200/50 mt-1">
        {value.rules.map((rule, idx) => (
          <div key={idx} className="relative group">
            {"combinator" in rule ? (
              // RECURSIVE GROUP
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
              // SINGLE RULE ROW
              <div className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded shadow-sm">
                {/* Variable A Picker */}
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

                {/* Value B Input */}
                <VariableInput
                  value={(rule as LogicRule).valueB}
                  onChange={(v) =>
                    updateIndex(idx, { ...rule, valueB: v } as LogicRule)
                  }
                  variables={variables}
                  placeholder="Value"
                />

                {/* Remove Button */}
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

        {/* Empty State */}
        {value.rules.length === 0 && (
          <div className="text-center py-2 text-[10px] text-slate-400 italic border border-dashed rounded">
            No rules defined
          </div>
        )}
      </div>

      {/* Footer Actions */}
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

// Helper Sub-Component for Inputs with Variable Suggestions
const VariableInput = ({ value, onChange, variables, placeholder }: any) => {
  // You can enhance this with the same dropdown logic from PropertiesPanel
  // For now, keeping it simple text input that accepts {{...}}
  return (
    <div className="relative flex-1 min-w-[80px]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs p-1 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
};
