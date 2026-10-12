import request from 'supertest';
import app from '../../app';
import User from './user.model';

// Helper: signup + verify + signin → returns accessToken
const createVerifiedUser = async (overrides = {}) => {
  const userData = {
    firstName: 'Test',
    lastName: 'User',
    email: 'user@example.com',
    phoneNumber: '+8801234567890',
    password: 'TestPass123!',
    confirmPassword: 'TestPass123!',
    role: 'tenant' as const,
    termsAccepted: true,
    ...overrides,
  };

  await request(app).post('/api/v1/auth/signup').send(userData);

  // Get OTP directly from DB
  const dbUser = await User.findOne({ email: userData.email }).select('+otp');
  await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: userData.email, otp: dbUser?.otp });

  const loginRes = await request(app)
    .post('/api/v1/auth/signin')
    .send({ email: userData.email, password: userData.password });

  return {
    accessToken: loginRes.body.data.session.accessToken as string,
    email: userData.email,
  };
};

// Helper: create admin user
const createAdminUser = async () => {
  const adminData = {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@example.com',
    phoneNumber: '+8801111111111',
    password: 'AdminPass123!',
    confirmPassword: 'AdminPass123!',
    role: 'admin' as const,
    termsAccepted: true,
  };

  await request(app).post('/api/v1/auth/signup').send(adminData);

  const dbUser = await User.findOne({ email: adminData.email }).select('+otp');
  await request(app)
    .post('/api/v1/auth/verify-email')
    .send({ email: adminData.email, otp: dbUser?.otp });

  const loginRes = await request(app)
    .post('/api/v1/auth/signin')
    .send({ email: adminData.email, password: adminData.password });

  return {
    adminToken: loginRes.body.data.session.accessToken as string,
    email: adminData.email,
  };
};

describe('User API', () => {
  let accessToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const user = await createVerifiedUser();
    accessToken = user.accessToken;

    const admin = await createAdminUser();
    adminToken = admin.adminToken;
  });

  // ─── GET /users/me ────────────────────────────────────────────────────────
  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('user@example.com');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /users/me ──────────────────────────────────────────────────────
  describe('PATCH /api/v1/users/me', () => {
    it('should update profile firstName and lastName', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Updated', lastName: 'Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Updated');
      expect(res.body.data.lastName).toBe('Name');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .send({ firstName: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /users/me/password ─────────────────────────────────────────────
  describe('PATCH /api/v1/users/me/password', () => {
    it('should change password with correct current password', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'TestPass123!',
          newPassword: 'NewPass456!',
          confirmPassword: 'NewPass456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail with wrong current password', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPass123!',
          newPassword: 'NewPass456!',
          confirmPassword: 'NewPass456!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /users (admin only) ──────────────────────────────────────────────
  describe('GET /api/v1/users', () => {
    it('should list users for admin', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /users/:id (admin only) ──────────────────────────────────────────
  describe('GET /api/v1/users/:id', () => {
    it('should get user by id for admin', async () => {
      const dbUser = await User.findOne({ email: 'user@example.com' });

      const res = await request(app)
        .get(`/api/v1/users/${dbUser?._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject non-admin users', async () => {
      const dbUser = await User.findOne({ email: 'user@example.com' });

      const res = await request(app)
        .get(`/api/v1/users/${dbUser?._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
