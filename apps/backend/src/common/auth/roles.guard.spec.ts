import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { UserRole } from "./roles.enum";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (
    user: any,
    requiredRoles?: UserRole[],
  ): ExecutionContext => {
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(requiredRoles);

    return mockContext;
  };

  describe("canActivate", () => {
    it("should allow access when no roles are required", () => {
      const context = createMockExecutionContext({ id: 1, role: "none" });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should deny access when user is not authenticated", () => {
      const context = createMockExecutionContext(null, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(false);
    });

    it("should allow access when user has required role", () => {
      const user = { id: 1, email: "admin@test.com", role: "admin" };
      const context = createMockExecutionContext(user, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should deny access when user does not have required role", () => {
      const user = { id: 1, email: "user@test.com", role: "none" };
      const context = createMockExecutionContext(user, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(false);
    });

    it("should allow access when user has one of multiple required roles", () => {
      const user = { id: 1, email: "accountant@test.com", role: "accountant" };
      const context = createMockExecutionContext(user, [
        UserRole.ADMIN,
        UserRole.ACCOUNTANT,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should deny access when user has none of the required roles", () => {
      const user = { id: 1, email: "user@test.com", role: "none" };
      const context = createMockExecutionContext(user, [
        UserRole.ADMIN,
        UserRole.ACCOUNTANT,
      ]);
      expect(guard.canActivate(context)).toBe(false);
    });

    it("should allow admin to access admin-only routes", () => {
      const user = { id: 1, email: "admin@test.com", role: "admin" };
      const context = createMockExecutionContext(user, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should allow accountant to access accountant routes", () => {
      const user = { id: 2, email: "accountant@test.com", role: "accountant" };
      const context = createMockExecutionContext(user, [UserRole.ACCOUNTANT]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should deny none role access to protected routes", () => {
      const user = { id: 3, email: "user@test.com", role: "none" };
      const context = createMockExecutionContext(user, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(false);
    });

    it("should handle undefined user object", () => {
      const context = createMockExecutionContext(undefined, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(false);
    });

    it("should handle user without role property", () => {
      const user = { id: 1, email: "user@test.com" };
      const context = createMockExecutionContext(user, [UserRole.ADMIN]);
      expect(guard.canActivate(context)).toBe(false);
    });
  });
});
