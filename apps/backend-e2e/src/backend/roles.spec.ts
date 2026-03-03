import axios from "axios";
import { PrismaClient } from "@prisma/client";
import {
  createTestUserWithSession,
  getAuthCookie,
  type TestUser 
} from "../support/auth-helper";

describe("Role-Based Access Control", () => {
  const prisma = new PrismaClient();
  const baseUrl = process.env.API_URL || "http://localhost:3001";

  let adminUser: TestUser;
  let accountantUser: TestUser;
  let normalUser: TestUser;
  let adminCookie: string;
  let accountantCookie: string;
  let normalCookie: string;

  beforeAll(async () => {
    // Create test users with different roles
    adminUser = await createTestUserWithSession();
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: "admin" },
    });

    accountantUser = await createTestUserWithSession();
    await prisma.user.update({
      where: { id: accountantUser.id },
      data: { role: "accountant" },
    });

    normalUser = await createTestUserWithSession();
    // normalUser will have 'none' role by default

    // Get auth cookies for each user
    adminCookie = await getAuthCookie(adminUser.sessionToken);
    accountantCookie = await getAuthCookie(accountantUser.sessionToken);
    normalCookie = await getAuthCookie(normalUser.sessionToken);
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "admin-test@example.com",
            "accountant-test@example.com",
            "normal-test@example.com",
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("Admin-only endpoints", () => {
    it("should allow admin to access admin dashboard", async () => {
      const response = await axios.get(`${baseUrl}/api/admin/dashboard`, {
        headers: { Cookie: adminCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("message");
      expect(response.data).toHaveProperty("stats");
    });

    it("should deny accountant access to admin dashboard", async () => {
      await expect(
        axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { 
            Cookie: accountantCookie
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 403,
        }),
      });
    });

    it("should deny normal user access to admin dashboard", async () => {
      await expect(
        axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { 
            Cookie: normalCookie
          },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 403,
        }),
      });
    });

    it("should deny unauthenticated access to admin dashboard", async () => {
      await expect(
        axios.get(`${baseUrl}/api/admin/dashboard`)
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 401,
        }),
      });
    });
  });

  describe("Multi-role endpoints", () => {
    it("should allow admin to access reports", async () => {
      const response = await axios.get(`${baseUrl}/api/admin/reports`, {
        headers: { Cookie: adminCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("message");
      expect(response.data).toHaveProperty("reports");
      expect(Array.isArray(response.data.reports)).toBe(true);
    });

    it("should allow accountant to access reports", async () => {
      const response = await axios.get(`${baseUrl}/api/admin/reports`, {
        headers: { Cookie: accountantCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("reports");
    });

    it("should deny normal user access to reports", async () => {
      await expect(
        axios.get(`${baseUrl}/api/admin/reports`, {
          headers: { Cookie: normalCookie },
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 403,
        }),
      });
    });
  });

  describe("Role verification", () => {
    it("should verify admin user has correct role in database", async () => {
      const user = await prisma.user.findUnique({
        where: { id: adminUser.id },
      });

      expect(user?.role).toBe("admin");
    });

    it("should verify accountant user has correct role in database", async () => {
      const user = await prisma.user.findUnique({
        where: { id: accountantUser.id },
      });

      expect(user?.role).toBe("accountant");
    });

    it("should verify normal user has none role in database", async () => {
      const user = await prisma.user.findUnique({
        where: { id: normalUser.id },
      });

      expect(user?.role).toBe("none");
    });
  });

  describe("Role changes", () => {
    it("should update user role successfully", async () => {
      // Change normal user to accountant
      await prisma.user.update({
        where: { id: normalUser.id },
        data: { role: "accountant" },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: normalUser.id },
      });

      expect(updatedUser?.role).toBe("accountant");

      // Change back to none
      await prisma.user.update({
        where: { id: normalUser.id },
        data: { role: "none" },
      });
    });
  });
});
