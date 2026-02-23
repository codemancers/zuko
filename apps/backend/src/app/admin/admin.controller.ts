import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { Roles, RolesGuard, UserRole } from '../../common/auth';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard) // Apply both guards - auth first, then roles
export class AdminController {
  /**
   * Admin-only endpoint
   * GET /api/admin/dashboard
   */
  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  getDashboard() {
    return {
      message: 'Welcome to the admin dashboard',
      stats: {
        totalUsers: 42,
        activeChats: 15,
        systemHealth: 'good',
      },
    };
  }

  /**
   * Accessible by both admins and accountants
   * GET /api/admin/reports
   */
  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  getReports() {
    return {
      message: 'Financial reports',
      reports: [
        { id: 1, name: 'Monthly Revenue', date: '2026-02-01' },
        { id: 2, name: 'Expense Report', date: '2026-02-01' },
      ],
    };
  }
}
