import { useState } from "react";
import { Building2, Check, MapPin, ShieldCheck, Phone, Mail, Landmark, FileText, BadgePercent, Users, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { type ModuleDef } from "@/lib/modules";

interface OwnerMember {
  id: string;
  name: string;
  role: "Proprietor" | "Managing Partner" | "Partner" | "Sleeping Partner";
  sharePercent: number;
  pan: string;
  phone: string;
}

export function BusinessProfilePage({ mod }: { mod: ModuleDef }) {
  const [constitution, setConstitution] = useState<"Partnership" | "Proprietorship">("Partnership");
  const [owners, setOwners] = useState<OwnerMember[]>([
    { id: "own-1", name: "Ravi Kumar", role: "Managing Partner", sharePercent: 60, pan: "ABRPK1234F", phone: "+91 98400 11223" },
    { id: "own-2", name: "Karthik Mohan", role: "Partner", sharePercent: 40, pan: "CMNPK9876Q", phone: "+91 98400 44556" },
  ]);

  const [profile, setProfile] = useState({
    legalName: "Velaan Bay Trading House",
    tradeName: "Velaan Bay Agro Hub",
    gstin: "33AAACV9876K1Z2",
    pan: "AAACV9876K",
    contactPerson: "Ravi Kumar (Managing Partner)",
    phone: "+91 98400 11223",
    email: "ops@velaanbay.com",
    address: "Plot 14, Cold Storage Corridor, Koyambedu Wholesale Market Complex, Chennai, Tamil Nadu 600092",
    bankName: "HDFC Bank, Koyambedu Wholesale Branch",
    accountNumber: "50200088991122",
    ifsc: "HDFC0001234",
    fssaiLicense: "12426002000188",
    marketMembership: "Koyambedu Wholesale Vegetable Merchants Association (KWVMA-884)",
  });

  const [isEditing, setIsEditing] = useState(false);

  const addPartner = () => {
    const newId = `own-${Date.now()}`;
    const newMember: OwnerMember = {
      id: newId,
      name: "",
      role: constitution === "Proprietorship" ? "Proprietor" : "Partner",
      sharePercent: 0,
      pan: "",
      phone: "",
    };
    setOwners([...owners, newMember]);
  };

  const removePartner = (id: string) => {
    if (owners.length <= 1) {
      toast.error("At least one proprietor or partner is required.");
      return;
    }
    setOwners(owners.filter((o) => o.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    toast.success("Trading House Business Profile updated successfully!");
  };

  const inputCl = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/25 disabled:bg-muted disabled:text-muted-foreground";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Stage A · F01 Business Profile</p>
          <h1 className="mt-1 text-2xl font-semibold lg:text-3xl">Trading House Business Profile & Master Setup</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Official business identity, GSTIN, PAN, bank accounts, and market association credentials.
          </p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? "outline" : "default"}
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </Button>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border bg-card p-6 shadow-card space-y-6">
        {/* Company Header Card */}
        <div className="flex items-center gap-4 rounded-xl bg-hero p-5 text-primary-foreground">
          <div className="grid size-12 place-items-center rounded-xl bg-white/10 text-white backdrop-blur">
            <Building2 className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{profile.tradeName}</h2>
            <p className="text-xs opacity-85 font-mono">{profile.legalName}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] opacity-90">
              <span className="flex items-center gap-1"><MapPin className="size-3" /> Koyambedu Wholesale Complex</span>
              <span>·</span>
              <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> GSTIN: {profile.gstin}</span>
            </div>
          </div>
        </div>

        {/* Section 1: Business Identity & Taxes */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <FileText className="size-4 text-primary" /> Identity & Taxation Credentials
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Trade / Brand Name</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.tradeName}
                onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Registered Legal Name</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.legalName}
                onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">GSTIN (Goods & Services Tax ID)</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.gstin}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Permanent Account Number (PAN)</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.pan}
                onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">FSSAI Food License Number</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.fssaiLicense}
                onChange={(e) => setProfile({ ...profile, fssaiLicense: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section: Ownership & Constitution (Partner / Proprietor) */}
        <div className="space-y-4 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Users className="size-4 text-primary" /> Ownership Constitution & Details (Partner / Proprietor)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure whether this Trading House is registered as a Partnership or Sole Proprietorship.
              </p>
            </div>
            {isEditing && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPartner}
                  className="h-8 gap-1.5 text-xs text-primary font-semibold"
                >
                  <Plus className="size-3.5" /> Add {constitution === "Proprietorship" ? "Proprietor" : "Partner"}
                </Button>
              </div>
            )}
          </div>

          {/* Constitution Selector */}
          <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2">
            <label className="text-xs font-semibold text-foreground">Business Constitution Structure</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="radio"
                  name="constitution"
                  value="Partnership"
                  checked={constitution === "Partnership"}
                  disabled={!isEditing}
                  onChange={() => setConstitution("Partnership")}
                  className="size-4 text-primary"
                />
                <span>Partnership Firm</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="radio"
                  name="constitution"
                  value="Proprietorship"
                  checked={constitution === "Proprietorship"}
                  disabled={!isEditing}
                  onChange={() => setConstitution("Proprietorship")}
                  className="size-4 text-primary"
                />
                <span>Sole Proprietorship</span>
              </label>
            </div>
          </div>

          {/* Owners List */}
          <div className="space-y-3">
            {owners.map((member, index) => (
              <div key={member.id} className="rounded-xl border bg-background p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="size-5 rounded-full bg-primary/10 grid place-items-center text-[10px]">
                      {index + 1}
                    </span>
                    {constitution === "Proprietorship" ? "Sole Proprietor" : `Partner #${index + 1}`}
                  </span>
                  {isEditing && owners.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePartner(member.id)}
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Full Legal Name</label>
                    <input
                      disabled={!isEditing}
                      className={inputCl}
                      value={member.name}
                      placeholder="e.g. Ravi Kumar"
                      onChange={(e) => {
                        const val = e.target.value;
                        setOwners(owners.map((o) => (o.id === member.id ? { ...o, name: val } : o)));
                      }}
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Designation / Role</label>
                    <select
                      disabled={!isEditing}
                      className={inputCl}
                      value={member.role}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setOwners(owners.map((o) => (o.id === member.id ? { ...o, role: val } : o)));
                      }}
                    >
                      {constitution === "Proprietorship" ? (
                        <option value="Proprietor">Proprietor</option>
                      ) : (
                        <>
                          <option value="Managing Partner">Managing Partner</option>
                          <option value="Partner">Partner</option>
                          <option value="Sleeping Partner">Sleeping Partner</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Profit / Capital Share %</label>
                    <input
                      type="number"
                      disabled={!isEditing}
                      className={inputCl}
                      value={member.sharePercent}
                      placeholder="e.g. 50"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setOwners(owners.map((o) => (o.id === member.id ? { ...o, sharePercent: val } : o)));
                      }}
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">PAN / Aadhaar</label>
                    <input
                      disabled={!isEditing}
                      className={inputCl}
                      value={member.pan}
                      placeholder="e.g. ABRPK1234F"
                      onChange={(e) => {
                        const val = e.target.value;
                        setOwners(owners.map((o) => (o.id === member.id ? { ...o, pan: val } : o)));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Contact & Warehouse Physical Location */}
        <div className="space-y-4 border-t pt-5">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <MapPin className="size-4 text-primary" /> Contact & Receiving Warehouse Address
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Primary Contact Person</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.contactPerson}
                onChange={(e) => setProfile({ ...profile, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Official Phone</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Operational Email</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-muted-foreground">Cold Storage & Receiving Warehouse Address</label>
              <textarea
                rows={2}
                disabled={!isEditing}
                className={inputCl}
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Banking & Market Association */}
        <div className="space-y-4 border-t pt-5">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Landmark className="size-4 text-primary" /> Banking & Market Memberships
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bank & Branch</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.bankName}
                onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Current Account Number</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.accountNumber}
                onChange={(e) => setProfile({ ...profile, accountNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">IFSC Code</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.ifsc}
                onChange={(e) => setProfile({ ...profile, ifsc: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-muted-foreground">Market Association Membership</label>
              <input
                disabled={!isEditing}
                className={inputCl}
                value={profile.marketMembership}
                onChange={(e) => setProfile({ ...profile, marketMembership: e.target.value })}
              />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground">
              <Check className="mr-1.5 size-4" /> Save Business Profile
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
