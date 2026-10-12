import ApiError from '../../src/utils/ApiError';
import { getPagination, buildPaginationMeta } from '../../src/utils/pagination';

describe('ApiError', () => {
  it('should create error with status code and message', () => {
    const error = ApiError.badRequest('Invalid input', ['field required']);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
    expect(error.errors).toEqual(['field required']);
    expect(error.isOperational).toBe(true);
  });

  it('should create unauthorized error', () => {
    const error = ApiError.unauthorized();
    expect(error.statusCode).toBe(401);
  });
});

describe('Pagination', () => {
  it('should parse page and limit from query value', () => {
    const result = getPagination({ page: '2', limit: '20' });
    expect(result).toEqual({ page: 2, limit: 20, skip: 20 });
  });

  it('should use defaults for invalid values', () => {
    const result = getPagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should build pagination meta', () => {
    const meta = buildPaginationMeta(50, 2, 10);
    expect(meta).toEqual({
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 5,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });
});
