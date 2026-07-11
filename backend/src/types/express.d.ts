import type { AuthContext, OrgContext } from './auth';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      org?: OrgContext;
    }
  }
}

export {};
