import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, User, X, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface EmployeeSelectProps {
  label?: string;
  roleFilter?: string | string[];
  value: string; // comma-separated names or single name
  onChange: (value: string) => void;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

export function EmployeeSelect({
  label,
  roleFilter,
  value,
  onChange,
  multiple = false,
  placeholder = "Select employee",
  className,
}: EmployeeSelectProps) {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roles = Array.isArray(roleFilter) ? roleFilter : roleFilter ? [roleFilter] : [];

  // Active employees from master
  const rawEmployees = data["employees"] ?? [];
  const activeEmployees = rawEmployees.filter((e) => e.status !== "Disabled");

  // Fallback if master employees is empty
  const defaultList = [
    { name: "Karthik M", role: "QC grader" },
    { name: "Divya R", role: "QC grader" },
    { name: "Senthil P", role: "Packer" },
    { name: "Priya S", role: "Receipt staff" },
    { name: "Ravi Kumar", role: "Admin" },
    { name: "Meena K", role: "Accounts" },
  ];

  const employeeList = activeEmployees.length > 0
    ? activeEmployees.map((e) => ({ name: String(e["name"]), role: String(e["role"] || "Staff") }))
    : defaultList;

  const selectedList = value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Strictly filter by roleFilter when provided (only show matching role, e.g. QC grader)
  const roleFilteredEmployees = roles.length > 0
    ? employeeList.filter((e) => roles.includes(e.role))
    : employeeList;

  // Preserve any currently selected employee(s) even if from custom entry
  const displayEmployees = [...roleFilteredEmployees];
  for (const sel of selectedList) {
    if (!displayEmployees.some((e) => e.name === sel)) {
      displayEmployees.push({ name: sel, role: roles[0] || "Custom" });
    }
  }

  const sortedEmployees = displayEmployees.sort((a, b) => a.name.localeCompare(b.name));

  const toggleEmployee = (name: string) => {
    if (multiple) {
      if (selectedList.includes(name)) {
        const next = selectedList.filter((n) => n !== name);
        onChange(next.join(", "));
      } else {
        const next = [...selectedList, name];
        onChange(next.join(", "));
      }
    } else {
      onChange(name);
      setOpen(false);
    }
  };

  const removeEmployee = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedList.filter((n) => n !== name);
    onChange(next.join(", "));
  };

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const name = customName.trim();
    if (!selectedList.includes(name)) {
      if (multiple) {
        onChange([...selectedList, name].join(", "));
      } else {
        onChange(name);
        setOpen(false);
      }
    }
    setCustomName("");
  };

  if (!multiple) {
    return (
      <div className={cn("space-y-1 text-sm", className)}>
        {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">{placeholder}</option>
          {sortedEmployees.map((emp) => (
            <option key={emp.name} value={emp.name}>
              {emp.name} ({emp.role})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1 text-sm relative", className)} ref={dropdownRef}>
      {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
      
      {/* Multi-select input button */}
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-lg border bg-background p-1.5 cursor-pointer focus-within:ring-2 focus-within:ring-primary/20 hover:border-primary/50 transition-colors"
      >
        {selectedList.length === 0 ? (
          <span className="px-2 text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          selectedList.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
            >
              <User className="size-3" />
              {name}
              <button
                type="button"
                onClick={(e) => removeEmployee(name, e)}
                className="hover:text-destructive p-0.5 rounded-full"
                title={`Remove ${name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}

        <div className="ml-auto pr-1 text-muted-foreground">
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-card p-2 shadow-xl animate-in fade-in-50 zoom-in-95">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Select {roles.length > 0 ? roles.join(" / ") : "Employees"}
          </div>

          <div className="space-y-0.5">
            {sortedEmployees.map((emp) => {
              const isSelected = selectedList.includes(emp.name);
              const isRoleMatch = roles.includes(emp.role);

              return (
                <div
                  key={emp.name}
                  onClick={() => toggleEmployee(emp.name)}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                    isSelected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "grid size-4 place-items-center rounded border",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </div>
                    <span>{emp.name}</span>
                  </div>

                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      isRoleMatch ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {emp.role}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Custom employee input */}
          <form onSubmit={addCustom} className="mt-2 border-t pt-2 flex items-center gap-1 px-1">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Add another name…"
              className="flex-1 rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center gap-0.5"
            >
              <Plus className="size-3" /> Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
