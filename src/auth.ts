import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or mobile", type: "text" },
        password: { label: "Password", type: "password" },
        businessId: { label: "Business", type: "text" },
        branchId: { label: "Branch", type: "text" },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!identifier || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            isActive: true,
            OR: [{ email: identifier }, { phone: identifier }],
          },
          include: {
            memberships: {
              where: { isActive: true },
              include: { business: { include: { branches: true } }, branch: true },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        let membership = user.memberships[0];
        if (credentials?.businessId) {
          membership =
            user.memberships.find((m) => m.businessId === credentials.businessId && (!credentials.branchId || m.branchId === credentials.branchId || !m.branchId)) ??
            membership;
        }
        if (!membership) {
          return {
            id: user.id,
            name: user.name,
            email: user.email ?? undefined,
            businessId: "",
            branchId: "",
            role: "OWNER",
          } as never;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? undefined,
          businessId: membership.businessId,
          branchId: membership.branchId ?? membership.business.branches[0]?.id ?? "",
          role: membership.role,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id: string;
          businessId: string;
          branchId?: string;
          role: string;
        };
        token.sub = u.id;
        token.businessId = u.businessId;
        token.branchId = u.branchId;
        token.role = u.role;
      }
      if (trigger === "update" && session) {
        if (session.businessId) token.businessId = session.businessId;
        if (session.branchId) token.branchId = session.branchId;
        if (session.role) token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.businessId = String(token.businessId ?? "");
      session.user.branchId = String(token.branchId ?? "");
      session.user.role = String(token.role ?? "");
      return session;
    },
  },
});
