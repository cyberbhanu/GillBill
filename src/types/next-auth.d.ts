import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      businessId: string;
      branchId: string;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    businessId?: string;
    branchId?: string;
    role?: string;
  }
}
