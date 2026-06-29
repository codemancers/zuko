import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest();
    const raw: string | undefined = req.user?.id ?? req.session?.user?.id;
    const id = raw != null ? parseInt(raw, 10) : NaN;
    if (isNaN(id) || id <= 0)
      throw new UnauthorizedException('Authenticated user not found');
    return id;
  },
);
