export const ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN", "INVENTORY", "HOUSEKEEPING"] as const;
export type Role = (typeof ROLES)[number];

const PERMISSIONS = {
  dashboard: ["OWNER", "MANAGER"],
  pos: ["OWNER", "MANAGER", "CASHIER"],
  orders: ["OWNER", "MANAGER", "CASHIER"],
  products: ["OWNER", "MANAGER", "INVENTORY"],
  categories: ["OWNER", "MANAGER", "INVENTORY"],
  inventory: ["OWNER", "MANAGER", "INVENTORY"],
  purchases: ["OWNER", "MANAGER", "INVENTORY"],
  customers: ["OWNER", "MANAGER", "CASHIER"],
  suppliers: ["OWNER", "MANAGER", "INVENTORY"],
  rooms: ["OWNER", "MANAGER", "HOUSEKEEPING"],
  kitchen: ["OWNER", "MANAGER", "KITCHEN", "CASHIER"],
  expenses: ["OWNER", "MANAGER"],
  staff: ["OWNER", "MANAGER"],
  reports: ["OWNER", "MANAGER"],
  printers: ["OWNER", "MANAGER"],
  settings: ["OWNER"],
  cancelSale: ["OWNER", "MANAGER"],
  adjustStockException: ["OWNER", "MANAGER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

export function navFor(role: string, modes: { restaurantEnabled: boolean; hotelEnabled: boolean }) {
  const items: { href: string; label: string; permission: Permission }[] = [
    { href: "/dashboard", label: "Dashboard", permission: "dashboard" },
    { href: "/pos", label: "POS Billing", permission: "pos" },
    { href: "/orders", label: "Orders", permission: "orders" },
    { href: "/products", label: "Food Menu / Products", permission: "products" },
    { href: "/categories", label: "Categories", permission: "categories" },
    { href: "/inventory", label: "Inventory", permission: "inventory" },
    { href: "/purchases", label: "Purchases", permission: "purchases" },
    { href: "/customers", label: "Customers", permission: "customers" },
    { href: "/suppliers", label: "Suppliers", permission: "suppliers" },
  ];
  if (modes.hotelEnabled) items.push({ href: "/rooms", label: "Hotel / Rooms", permission: "rooms" });
  if (modes.restaurantEnabled) items.push({ href: "/kitchen", label: "Kitchen Display", permission: "kitchen" });
  items.push(
    { href: "/expenses", label: "Expenses", permission: "expenses" },
    { href: "/staff", label: "Staff & Permissions", permission: "staff" },
    { href: "/reports", label: "Reports", permission: "reports" },
    { href: "/printers", label: "Printers & Devices", permission: "printers" },
    { href: "/settings", label: "Business Settings", permission: "settings" },
  );
  return items.filter((item) => can(role, item.permission));
}
