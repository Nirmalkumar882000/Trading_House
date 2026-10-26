import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { ROLES, isModuleAllowedForRole, type UserRole } from "@/lib/rbac";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, ChevronDown, Check, KeyRound, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function RoleSwitcher() {
  const { role, setRole } = useStore();
  const current = ROLES[role] ?? ROLES["Admin"];
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    toast.info(`Switched active persona to ${ROLES[newRole]?.label}`);

    // If current path is restricted for this new persona, redirect to their primary module
    const currentSlug = path.startsWith("/m/") ? path.replace("/m/", "") : "";
    if (currentSlug && !isModuleAllowedForRole(currentSlug, newRole)) {
      const allowed = ROLES[newRole]?.primaryModules ?? [];
      if (allowed.length > 0) {
        navigate({ to: "/m/$module", params: { module: allowed[0] } });
        toast.success(`Redirected to ${ROLES[newRole]?.label} workspace`);
      } else {
        navigate({ to: "/" });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:opacity-90 outline-none shadow-sm",
              current.badgeColor
            )}
          >
            <Shield className="size-3.5" />
            <span>{current.label}</span>
            <ChevronDown className="size-3 opacity-60 ml-0.5" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={6} className="w-[340px] max-h-[75vh] overflow-y-auto p-1.5 shadow-xl border bg-card">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider p-0">
                Active Role / Persona
              </DropdownMenuLabel>
              <button
                type="button"
                onClick={() => setShowCredentialsModal(true)}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <KeyRound className="size-3" /> Credentials
              </button>
            </div>
            <DropdownMenuSeparator />

            {Object.values(ROLES).map((r) => {
              const isSelected = r.role === role;
              return (
                <DropdownMenuItem
                  key={r.role}
                  onClick={() => handleSelectRole(r.role)}
                  className={cn(
                    "flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg cursor-pointer transition-colors border mb-1",
                    isSelected ? "bg-primary/10 border-primary/30 text-primary font-semibold" : "border-transparent hover:bg-muted"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold">{r.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-normal leading-snug">
                    {r.description}
                  </p>
                  <div className="mt-0.5 flex w-full items-center justify-between rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    <span>{r.credentials?.email || `${r.role.toLowerCase().replace(/ /g, "")}@velaanbay.com`}</span>
                    <span className="font-semibold text-foreground/85">Pwd: {r.credentials?.password || `${r.role.slice(0, 4)}#2026`}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowCredentialsModal(true)}
          title="View Role Credentials & Logins"
          className="size-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <KeyRound className="size-3.5" />
        </Button>
      </div>

      {/* Role Credentials Modal (Centered, header pinned via portal to document.body) */}
      {showCredentialsModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowCredentialsModal(false)}
        >
          <div
            className="relative flex w-full max-w-2xl max-h-[85vh] flex-col rounded-2xl border bg-card p-5 sm:p-6 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Role Credentials & Login Directory</h2>
                  <p className="text-xs text-muted-foreground">Dedicated credentials for all system personas and operational modules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCredentialsModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pt-3 space-y-2.5">
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Role / Persona</th>
                      <th className="px-3 py-2 text-left">Email / Username</th>
                      <th className="px-3 py-2 text-left">Password</th>
                      <th className="px-3 py-2 text-right">Quick Switch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.values(ROLES).map((r) => {
                      const isCurrent = r.role === role;
                      return (
                        <tr key={r.role} className={cn("hover:bg-muted/30 transition-colors", isCurrent && "bg-primary/5")}>
                          <td className="px-3 py-2.5 font-semibold text-foreground">
                            <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border", r.badgeColor)}>
                              {r.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{r.credentials?.email}</span>
                              <button
                                type="button"
                                title="Copy email"
                                onClick={() => copyToClipboard(r.credentials?.email, "Email")}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{r.credentials?.password}</span>
                              <button
                                type="button"
                                title="Copy password"
                                onClick={() => copyToClipboard(r.credentials?.password, "Password")}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant={isCurrent ? "secondary" : "outline"}
                              disabled={isCurrent}
                              onClick={() => {
                                handleSelectRole(r.role);
                                setShowCredentialsModal(false);
                              }}
                              className="h-6 px-2 text-[10px] font-semibold"
                            >
                              {isCurrent ? "Active" : "Login as Role"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="shrink-0 border-t pt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">RBAC: Permissions are enforced in real time upon switching roles.</span>
              <Button size="sm" onClick={() => setShowCredentialsModal(false)}>Close</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
