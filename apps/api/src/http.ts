import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Role } from '@prisma/client';
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_ERROR') { super(message); }
}
export const check = (condition: unknown, status: number, message: string): asserts condition => {
  if (!condition) throw new ApiError(status, message);
};
export function route(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
}
declare global {
  namespace Express {
    interface Request { user: { id: string; email: string; role: Role; emailVerifiedAt: Date | null }; }
  }
}
