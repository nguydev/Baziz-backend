import type { IUserDocument } from '../modules/user/user.model';
import type { TeamContext } from '../modules/team/team.types';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      team?: TeamContext;
      requestId?: string;
      startTime?: number;
    }
  }
}

export {};
