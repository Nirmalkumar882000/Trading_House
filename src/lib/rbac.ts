export type UserRole =
  | "Admin"
  | "Trading House Owner"
  | "Receipt Staff"
  | "QC Supervisor"
  | "QC Grader"
  | "Packing Supervisor"
  | "Packer"
  | "Sales Staff"
  | "Pricing Officer"
  | "Accounts Staff"
  | "HR Supervisor"
  | "Buyer"
  | "Market Supplier"
  | "Driver";

export interface RoleDef {
  role: UserRole;
  label: string;
  badgeColor: string;
  description: string;
  canViewPrices: boolean;
  canEditPrices: boolean;
  canManageFinance: boolean;
  canReceiveGoods: boolean;
  canGradeQuality: boolean;
  canPackGoods: boolean;
  canManageSales: boolean;
  canManageTrips: boolean;
  canViewReports: boolean;
  primaryModules: string[];
  credentials: {
    email: string;
    username: string;
    password: string;
  };
}

export const ROLES: Record<UserRole, RoleDef> = {
  Admin: {
    role: "Admin",
    label: "Administrator",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    description: "Full system administration, master data, pricing, financial controls & reporting.",
    canViewPrices: true,
    canEditPrices: true,
    canManageFinance: true,
    canReceiveGoods: true,
    canGradeQuality: true,
    canPackGoods: true,
    canManageSales: true,
    canManageTrips: true,
    canViewReports: true,
    primaryModules: ["business-profile", "suppliers", "buyers", "employees", "invoices", "workflow-reports"],
    credentials: {
      email: "admin@velaanbay.com",
      username: "admin_ravi",
      password: "Admin#2026",
    },
  },
  "Trading House Owner": {
    role: "Trading House Owner",
    label: "Trading House Owner",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    description: "Executive oversight of trading house operations, money position & margins.",
    canViewPrices: true,
    canEditPrices: true,
    canManageFinance: true,
    canReceiveGoods: true,
    canGradeQuality: true,
    canPackGoods: true,
    canManageSales: true,
    canManageTrips: true,
    canViewReports: true,
    primaryModules: ["workflow-reports", "invoices", "demand-plan", "trips"],
    credentials: {
      email: "owner@velaanbay.com",
      username: "owner_velaan",
      password: "Owner#2026",
    },
  },
  "Receipt Staff": {
    role: "Receipt Staff",
    label: "Receipt Staff (Weighing Bay)",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    description: "Captures arrival weights and container returns. RESTRICTED from viewing purchase rates.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: true,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: false,
    primaryModules: ["receipts", "containers", "transport"],
    credentials: {
      email: "receipt@velaanbay.com",
      username: "receipt_priya",
      password: "Receipt#2026",
    },
  },
  "QC Supervisor": {
    role: "QC Supervisor",
    label: "QC Supervisor",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    description: "Assigns ungraded lots to graders, oversees Stage 1 & 2 yield & verifies rejects.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: true,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: true,
    primaryModules: ["quality-check", "inventory", "stock-movements"],
    credentials: {
      email: "qc.supervisor@velaanbay.com",
      username: "qc_super_ravi",
      password: "QCSuper#2026",
    },
  },
  "QC Grader": {
    role: "QC Grader",
    label: "QC Grader",
    badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/30",
    description: "Executes Stage 1 (Grade A / reject) and Stage 2 (Grade B / trash) quality grading.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: true,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: false,
    primaryModules: ["quality-check"],
    credentials: {
      email: "qc.grader@velaanbay.com",
      username: "qc_grader_karthik",
      password: "QCGrade#2026",
    },
  },
  "Packing Supervisor": {
    role: "Packing Supervisor",
    label: "Packing Supervisor",
    badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
    description: "Allocates graded stock to bag sizes, schedules packers & manages QR sticker printing.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: true,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: true,
    primaryModules: ["packing", "inventory", "catalogue"],
    credentials: {
      email: "pack.supervisor@velaanbay.com",
      username: "pack_super_senthil",
      password: "PackSuper#2026",
    },
  },
  Packer: {
    role: "Packer",
    label: "Packing Employee",
    badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
    description: "Weighs and bags stock into specified packs, applies QR stickers, verifies scan.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: true,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: false,
    primaryModules: ["packing"],
    credentials: {
      email: "packer@velaanbay.com",
      username: "packer_senthil",
      password: "Packer#2026",
    },
  },
  "Sales Staff": {
    role: "Sales Staff",
    label: "Sales Staff",
    badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    description: "Manages customer purchase orders, sales orders, catalogue offers & dispatch.",
    canViewPrices: true,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: true,
    canManageTrips: true,
    canViewReports: true,
    primaryModules: ["purchase-orders", "sales-orders", "catalogue", "dispatch", "deliveries", "returns"],
    credentials: {
      email: "sales@velaanbay.com",
      username: "sales_arun",
      password: "Sales#2026",
    },
  },
  "Pricing Officer": {
    role: "Pricing Officer",
    label: "Authorised Pricing Officer",
    badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    description: "Authorised to sync supplier purchase prices and set buyer catalogue selling rates.",
    canViewPrices: true,
    canEditPrices: true,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: true,
    canManageTrips: false,
    canViewReports: true,
    primaryModules: ["supplier-prices", "catalogue", "invoices"],
    credentials: {
      email: "pricing@velaanbay.com",
      username: "pricing_divya",
      password: "Pricing#2026",
    },
  },
  "Accounts Staff": {
    role: "Accounts Staff",
    label: "Accounts & Finance Staff",
    badgeColor: "bg-green-500/10 text-green-600 border-green-500/30",
    description: "Manages buyer invoices, receipts, supplier settlements, credit notes & payroll.",
    canViewPrices: true,
    canEditPrices: true,
    canManageFinance: true,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: true,
    primaryModules: ["invoices", "buyer-payments", "supplier-payments", "credit-notes", "attendance", "expenses", "workflow-reports"],
    credentials: {
      email: "accounts@velaanbay.com",
      username: "accounts_priya",
      password: "Accounts#2026",
    },
  },
  "HR Supervisor": {
    role: "HR Supervisor",
    label: "HR & People Supervisor",
    badgeColor: "bg-pink-500/10 text-pink-600 border-pink-500/30",
    description: "Employee onboarding, role assignments, attendance records & salary calculation.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: true,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: true,
    primaryModules: ["employees", "attendance"],
    credentials: {
      email: "hr@velaanbay.com",
      username: "hr_admin",
      password: "HRAdmin#2026",
    },
  },
  Buyer: {
    role: "Buyer",
    label: "Buyer (Buyer Portal View)",
    badgeColor: "bg-sky-500/10 text-sky-600 border-sky-500/30",
    description: "Customer portal view: browse live catalogue, raise purchase orders & track deliveries.",
    canViewPrices: true,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: true,
    canManageTrips: false,
    canViewReports: false,
    primaryModules: ["catalogue", "purchase-orders", "deliveries", "invoices"],
    credentials: {
      email: "buyer@freshmart.com",
      username: "freshmart_buyer",
      password: "Buyer#2026",
    },
  },
  "Market Supplier": {
    role: "Market Supplier",
    label: "Market Supplier (Market Trader Portal)",
    badgeColor: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    description: "Market Trader supplier portal: view trip DCs, enter purchase rates & track payables.",
    canViewPrices: true,
    canEditPrices: true,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: false,
    canViewReports: false,
    primaryModules: ["trips", "supplier-prices", "supplier-payments"],
    credentials: {
      email: "supplier@murugan.com",
      username: "murugan_trader",
      password: "Supplier#2026",
    },
  },
  Driver: {
    role: "Driver",
    label: "Driver / Transporter",
    badgeColor: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30",
    description: "FleetMate driver portal: view market collection & sales delivery trips, record signatures.",
    canViewPrices: false,
    canEditPrices: false,
    canManageFinance: false,
    canReceiveGoods: false,
    canGradeQuality: false,
    canPackGoods: false,
    canManageSales: false,
    canManageTrips: true,
    canViewReports: false,
    primaryModules: ["trips", "dispatch", "deliveries"],
    credentials: {
      email: "driver@fleetmate.com",
      username: "driver_raja",
      password: "Driver#2026",
    },
  },
};

export function canViewPrice(role: UserRole): boolean {
  return ROLES[role]?.canViewPrices ?? true;
}

export function canEditPrice(role: UserRole): boolean {
  return ROLES[role]?.canEditPrices ?? true;
}

export function maskPriceIfRestricted(val: string, role: UserRole): string {
  if (canViewPrice(role)) return val;
  return "•••• (Restricted)";
}

export function isModuleAllowedForRole(slug: string, role: UserRole): boolean {
  if (role === "Admin" || role === "Trading House Owner") return true;
  if (!slug || slug === "") return true;
  const allowed = ROLES[role]?.primaryModules ?? [];
  return allowed.includes(slug);
}

