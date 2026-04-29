import { describe, it, expect, beforeEach } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { RolesGuard } from '../../common/auth/roles.guard';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return admin dashboard data', () => {
      const result = controller.getDashboard();
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('totalUsers');
      expect(result.stats).toHaveProperty('activeChats');
      expect(result.stats).toHaveProperty('systemHealth');
    });

    it('should return expected dashboard structure', () => {
      const result = controller.getDashboard();
      expect(result.message).toBe('Welcome to the admin dashboard');
      expect(typeof result.stats.totalUsers).toBe('number');
      expect(typeof result.stats.activeChats).toBe('number');
      expect(typeof result.stats.systemHealth).toBe('string');
    });
  });

  describe('getReports', () => {
    it('should return financial reports', () => {
      const result = controller.getReports();
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('reports');
      expect(Array.isArray(result.reports)).toBe(true);
    });

    it('should return reports with correct structure', () => {
      const result = controller.getReports();
      expect(result.reports.length).toBeGreaterThan(0);
      result.reports.forEach((report: any) => {
        expect(report).toHaveProperty('id');
        expect(report).toHaveProperty('name');
        expect(report).toHaveProperty('date');
      });
    });
  });
});
