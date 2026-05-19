import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { Roles, RolesGuard, UserRole } from '../../common/auth';

@ApiTags('Admin')
@ApiBearerAuth('session')
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard) // Apply both guards - auth first, then roles
export class AdminController {
  /**
   * Admin-only endpoint
   * GET /api/admin/dashboard
   */
  @Get('dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin dashboard stats (admin only)' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  @ApiResponse({ status: 403, description: 'Requires ADMIN role' })
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
  @ApiOperation({ summary: 'Financial reports (admin or accountant)' })
  @ApiResponse({ status: 200, description: 'Reports list' })
  @ApiResponse({
    status: 403,
    description: 'Requires ADMIN or ACCOUNTANT role',
  })
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
