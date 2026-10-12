import type { PaginationMeta } from '../types/api.types';

export default class ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;

  constructor(statusCode: number, message: string, data?: T, meta?: PaginationMeta) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined) this.data = data;
    if (meta !== undefined) this.meta = meta;
  }

  static ok<T>(message: string, data?: T, meta?: PaginationMeta): ApiResponse<T> {
    return new ApiResponse(200, message, data, meta);
  }

  static created<T>(message: string, data?: T): ApiResponse<T> {
    return new ApiResponse(201, message, data);
  }

  static noContent(message = 'Deleted successfully'): ApiResponse<undefined> {
    return new ApiResponse(204, message);
  }
}
