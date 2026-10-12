/**
 * Contact Module Tests
 * Comprehensive test suite for contact management endpoints
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../user/user.model';
import Contact from './contact.model';

describe('Contact Module', () => {
  let landlordToken: string;
  let landlordId: string;
  let contactId: string;

  const landlordUser = {
    firstName: 'John',
    email: 'landlord.test@example.com',
    password: 'LandlordPass123!',
    confirmPassword: 'LandlordPass123!',
    role: 'landlord' as const,
    termsAccepted: true,
  };

  const validContact = {
    company: 'Spark Electric Ltd',
    contactPerson: 'John Smith',
    phone: '+44 20 1234 5678',
    email: 'john@sparkelectric.com',
    profession: 'electrician',
    notes: 'Available 24/7 for emergencies',
  };

  beforeAll(async () => {
    await User.deleteMany({ email: landlordUser.email });
    await Contact.deleteMany({});

    const signupResponse = await request(app)
      .post('/api/v1/auth/signup')
      .send(landlordUser);

    landlordToken = signupResponse.body.data.session.accessToken;
    landlordId = signupResponse.body.data.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: landlordUser.email });
    await Contact.deleteMany({});
  });

  describe('POST /contacts', () => {
    it('should create a new contact successfully', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(validContact);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.company).toBe(validContact.company);
      expect(response.body.data.contact.contactPerson).toBe(validContact.contactPerson);
      expect(response.body.data.contact.phone).toBe(validContact.phone);
      expect(response.body.data.contact.email).toBe(validContact.email);
      expect(response.body.data.contact.profession).toBe(validContact.profession);
      expect(response.body.data.contact.id).toBeDefined();

      contactId = response.body.data.contact.id;
    });

    it('should create contact without optional email', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Quick Plumbing',
          contactPerson: 'Sarah Johnson',
          phone: '+44 20 9876 5432',
          profession: 'plumber',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.email).toBeNull();
    });

    it('should create contact without optional notes', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Prime Landscaping',
          contactPerson: 'Mike Brown',
          phone: '+44 20 5555 7777',
          email: 'mike@primelandscape.com',
          profession: 'landscaper',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.notes).toBeNull();
    });

    it('should fail without required company field', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          contactPerson: 'Test Person',
          phone: '+44 20 1111 2222',
          profession: 'electrician',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail without required contactPerson field', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Test Company',
          phone: '+44 20 1111 2222',
          profession: 'electrician',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail without required phone field', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Test Company',
          contactPerson: 'Test Person',
          profession: 'electrician',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail without required profession field', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Test Company',
          contactPerson: 'Test Person',
          phone: '+44 20 1111 2222',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          ...validContact,
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid profession', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          ...validContact,
          profession: 'invalid_profession',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid phone format - letters', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          ...validContact,
          phone: 'call-me-now',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('phone number format');
    });

    it('should fail with invalid phone format - too short', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          ...validContact,
          phone: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should accept various valid phone formats', async () => {
      const phoneFormats = [
        '+1-555-123-4567',
        '(555) 123-4567',
        '+8801712345678',
        '020 1234 5678',
      ];

      for (const phone of phoneFormats) {
        const response = await request(app)
          .post('/api/v1/contacts')
          .set('Authorization', `Bearer ${landlordToken}`)
          .send({
            ...validContact,
            company: `Test Company ${phone}`,
            phone,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });

    it('should fail without authentication', async () => {
      const response = await request(app).post('/api/v1/contacts').send(validContact);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /contacts', () => {
    it('should get all contacts for the landlord', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?page=1&limit=2')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should filter by profession - electrician', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?profession=electrician')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((contact: { profession: string }) => {
        expect(contact.profession).toBe('electrician');
      });
    });

    it('should filter by profession - plumber', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?profession=plumber')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((contact: { profession: string }) => {
        expect(contact.profession).toBe('plumber');
      });
    });

    it('should search by company name', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?search=electric')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search by contact person', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?search=john')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search by phone number', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?search=1234')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should handle regex special characters in search safely', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?search=.*+?^${}()|[]\\')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should combine search and profession filter', async () => {
      const response = await request(app)
        .get('/api/v1/contacts?search=electric&profession=electrician')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/v1/contacts');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /contacts/stats', () => {
    it('should get contact statistics', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/stats')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.totalContacts).toBeGreaterThan(0);
      expect(response.body.data.stats.byProfession).toBeDefined();
      expect(typeof response.body.data.stats.byProfession).toBe('object');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/v1/contacts/stats');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /contacts/:id', () => {
    it('should get contact by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.id).toBe(contactId);
      expect(response.body.data.contact.company).toBe(validContact.company);
    });

    it('should fail with invalid contact ID format', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/invalid-id')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with non-existent contact ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/v1/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get(`/api/v1/contacts/${contactId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /contacts/:id', () => {
    it('should update contact company name', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ company: 'Updated Electric Ltd' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.company).toBe('Updated Electric Ltd');
    });

    it('should update contact phone number', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ phone: '+44 20 9999 8888' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.phone).toBe('+44 20 9999 8888');
    });

    it('should update contact email', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ email: 'newemail@sparkelectric.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.email).toBe('newemail@sparkelectric.com');
    });

    it('should update contact profession', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ profession: 'general_contractor' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.profession).toBe('general_contractor');
    });

    it('should update contact notes', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ notes: 'Updated notes for this contact' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.notes).toBe('Updated notes for this contact');
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          company: 'Multi-Update Electric',
          phone: '+44 20 7777 6666',
          notes: 'Multiple fields updated',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.company).toBe('Multi-Update Electric');
      expect(response.body.data.contact.phone).toBe('+44 20 7777 6666');
      expect(response.body.data.contact.notes).toBe('Multiple fields updated');
    });

    it('should fail with empty body', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No fields provided');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid profession', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ profession: 'invalid_type' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid phone format', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ phone: 'abc-def' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid contact ID format', async () => {
      const response = await request(app)
        .patch('/api/v1/contacts/invalid-id')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ company: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with non-existent contact ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/v1/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ company: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${contactId}`)
        .send({ company: 'Test' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /contacts/:id', () => {
    it('should delete contact (soft delete)', async () => {
      const response = await request(app)
        .delete(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deletedContact = await Contact.findById(contactId);
      expect(deletedContact?.isActive).toBe(false);
    });

    it('should not find deleted contact in list', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      const foundDeleted = response.body.data.find(
        (c: { id: string }) => c.id === contactId
      );
      expect(foundDeleted).toBeUndefined();
    });

    it('should fail to get deleted contact by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/contacts/${contactId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid contact ID format', async () => {
      const response = await request(app)
        .delete('/api/v1/contacts/invalid-id')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with non-existent contact ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/v1/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const newContact = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(validContact);

      const response = await request(app).delete(
        `/api/v1/contacts/${newContact.body.data.contact.id}`
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Cross-Landlord Isolation (Security)', () => {
    let landlord2Token: string;
    let landlord2Id: string;
    let landlord2ContactId: string;

    const landlord2User = {
      firstName: 'Jane',
      email: 'landlord2.test@example.com',
      password: 'Landlord2Pass123!',
      confirmPassword: 'Landlord2Pass123!',
      role: 'landlord' as const,
      termsAccepted: true,
    };

    const landlord2Contact = {
      company: 'Landlord2 Electric Co',
      contactPerson: 'Alice Williams',
      phone: '+44 20 8888 9999',
      email: 'alice@landlord2electric.com',
      profession: 'electrician',
      notes: 'This belongs to landlord2',
    };

    beforeAll(async () => {
      await User.deleteMany({ email: landlord2User.email });

      const signupResponse = await request(app)
        .post('/api/v1/auth/signup')
        .send(landlord2User);

      landlord2Token = signupResponse.body.data.session.accessToken;
      landlord2Id = signupResponse.body.data.user.id;

      const contactResponse = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlord2Token}`)
        .send(landlord2Contact);

      landlord2ContactId = contactResponse.body.data.contact.id;
    });

    afterAll(async () => {
      await User.deleteMany({ email: landlord2User.email });
      await Contact.deleteMany({ landlordId: landlord2Id });
    });

    it('should not access another landlord contact by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/contacts/${landlord2ContactId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Contact not found');
    });

    it('should not update another landlord contact', async () => {
      const response = await request(app)
        .patch(`/api/v1/contacts/${landlord2ContactId}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ company: 'Hacked Company' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Contact not found');

      const contact = await Contact.findById(landlord2ContactId);
      expect(contact?.company).toBe(landlord2Contact.company);
    });

    it('should not delete another landlord contact', async () => {
      const response = await request(app)
        .delete(`/api/v1/contacts/${landlord2ContactId}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);

      const contact = await Contact.findById(landlord2ContactId);
      expect(contact?.isActive).toBe(true);
    });

    it('should not see another landlord contacts in list', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      const foundOtherLandlord = response.body.data.find(
        (c: { id: string }) => c.id === landlord2ContactId
      );
      expect(foundOtherLandlord).toBeUndefined();
    });

    it('should not see another landlord contacts in search', async () => {
      const response = await request(app)
        .get(`/api/v1/contacts?search=${landlord2Contact.company}`)
        .set('Authorization', `Bearer ${landlordToken}`);

      expect(response.status).toBe(200);
      const foundOtherLandlord = response.body.data.find(
        (c: { id: string }) => c.id === landlord2ContactId
      );
      expect(foundOtherLandlord).toBeUndefined();
    });

    it('landlord2 should see their own contacts', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${landlord2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      const foundOwn = response.body.data.find(
        (c: { id: string }) => c.id === landlord2ContactId
      );
      expect(foundOwn).toBeDefined();
    });
  });
});
