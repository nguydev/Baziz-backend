import request from "supertest";
import app from "../../app";
import User from "../user/user.model";

describe("Auth Module", () => {
  const testUser = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phoneNumber: "+8801234567890",
    password: "TestPass123!",
    confirmPassword: "TestPass123!",
    role: "tenant" as const,
    termsAccepted: true,
  };

  beforeAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: testUser.email });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({ email: testUser.email });
  });

  describe("POST /auth/signup", () => {
    it("should register a new user successfully", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.session.accessToken).toBeDefined();
      expect(response.body.data.session.refreshToken).toBeDefined();
    });

    it("should fail with duplicate email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain("already registered");
    });

    it("should fail with invalid password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          ...testUser,
          email: "newuser@example.com",
          password: "weak",
          confirmPassword: "weak",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should fail with mismatched passwords", async () => {
      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          ...testUser,
          email: "newuser2@example.com",
          confirmPassword: "DifferentPass123!",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /auth/verify-email", () => {
    it("should verify email with correct OTP", async () => {
      // Get the OTP from the user document
      const user = await User.findOne({ email: testUser.email }).select("+otp");
      const otp = user?.otp;

      const response = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({
          email: testUser.email,
          otp,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isVerified).toBe(true);
    });

    it("should fail with invalid OTP", async () => {
      const response = await request(app)
        .post("/api/v1/auth/verify-email")
        .send({
          email: testUser.email,
          otp: "000000",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /auth/signin", () => {
    it("should login successfully with correct credentials", async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.session.accessToken).toBeDefined();
    });

    it("should fail with incorrect password", async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: "WrongPassword123!",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should fail with non-existent email", async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: "nonexistent@example.com",
        password: testUser.password,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /auth/refresh-token", () => {
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      refreshToken = response.body.data.session.refreshToken;
    });

    it("should refresh access token successfully", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh-token")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it("should fail with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh-token")
        .send({ refreshToken: "invalid-token" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should send OTP for password reset", async () => {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("OTP sent");
    });

    it("should return success even for non-existent email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /auth/verify-otp", () => {
    it("should verify OTP for password reset", async () => {
      // Get the OTP from the user document
      const user = await User.findOne({ email: testUser.email }).select("+otp");
      const otp = user?.otp;

      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: testUser.email,
        otp,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });
  });

  describe("GET /auth/me", () => {
    let accessToken: string;

    beforeAll(async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      accessToken = response.body.data.session.accessToken;
    });

    it("should get current user with valid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it("should fail without token", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should fail with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /auth/logout", () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      accessToken = response.body.data.session.accessToken;
      refreshToken = response.body.data.session.refreshToken;
    });

    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("Logged out");
    });

    it("should fail without authentication", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
