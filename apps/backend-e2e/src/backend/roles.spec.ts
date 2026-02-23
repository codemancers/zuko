import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { createTestUser, getAuthCookie } from '../support/auth-helper';

describe('Role-Based Access Control', () => {
  const prisma = new PrismaClient();
  const baseUrl = process.env.API_URL || 'http://localhost:3001';

  let adminUser: any;
  let accountantUser: any;
  let normalUser: any;
  let adminCookie: string;
  let accountantCookie: string;
  let normalCookie: string;

  beforeAll(async () => {
    // Create test users with different roles
    adminUser = await createTestUser('admin-test@example.com', 'Admin User');
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: 'admin' },
    });

    accountantUser = await createTestUser('accountant-test@example.com', 'Accountant User');
    await prisma.user.update({
      where: { id: accountantUser.id },
      data: { role: 'accountant' },
    });

    normalUser = await createTestUser('normal-test@example.com', 'Normal User');
    // normalUser will have 'none' role by default

    // Get auth cookies for each user
    adminCookie = await getAuthCookie(adminUser.id);
    accountantCookie = await getAuthCookie(accountantUser.id);
    normalCookie = await getAuthCookie(normalUser.id);
  });

  afterAll(async () => {
    // Cleanup test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'admin-test@example.com',
            'accountant-test@example.com',
            'normal-test@example.com',
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('Admin-only endpoints', () => {
    it('should allow admin to access admin dashboard', async () => {
      const response = await axios.get(`${baseUrl}/api/admin/dashboard`, {
        headers: { Cookie: adminCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('stats');
    });

    it('should deny accountant access to admin dashboard', async () => {
      try {
        await axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { Cookie: accountantCookie },
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
      }
    });

    it('should deny normal user access to admin dashboard', async () => {
      try {
        await axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { Cookie: normalCookie },
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
      }
    });

    it('should deny unauthenticated access to admin dashboard', async () => {
      try {
        await axios.get(`${baseUrl}/api/admin/dashboard`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect([401, 403]).toContain(error.response.status);
      }
    });
  });

  describe('Multi-role endpoints', () => {
    it('should allow admin to access reports', async () => {
      const response = await axios.get(`${baseUrl}/api/admin/reports`, {
        headers: { Cookie: adminCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('reports');
      expect(Array.isArray(response.data.reports)).toBe(true);
    });

    it('should allow accountant to access reports', async () => {
      const response = await axios.get(`${baseUrl}/api/admin/reports`, {
        headers: { Cookie: accountantCookie },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('reports');
    });

    it('should deny normal user access to reports', async () => {
      try {
        await axios.get(`${baseUrl}/api/admin/reports`, {
          headers: { Cookie: normalCookie },
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
      }
    });
  });

  describe('Role verification', () => {
    it('should verify admin user has correct role in database', async () => {
      const user = await prisma.user.findUnique({
        where: { id: adminUser.id },
      });

      expect(user?.role).toBe('admin');
    });

    it('should verify accountant user has correct role in database', async () => {
      const user = await prisma.user.findUnique({
        where: { id: accountantUser.id },
      });

      expect(user?.role).toBe('accountant');
    });

    it('should verify normal user has none role in database', async () => {
      const user = await prisma.user.findUnique({
        where: { id: normalUser.id },
      });

      expect(user?.role).toBe('none');
    });
  });

  describe('Role changes', () => {
    it('should update user role successfully', async () => {
      // Change normal user to accountant
      await prisma.user.update({
        where: { id: normalUser.id },
        data: { role: 'accountant' },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: normalUser.id },
      });

      expect(updatedUser?.role).toBe('accountant');

      // Change back to none
      await prisma.user.update({
        where: { id: normalUser.id },
        data: { role: 'none' },
      });
    });
  });
});
