export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  [key: string]: unknown; // allow extra fields like summary
}

export interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
