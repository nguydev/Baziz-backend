import request from 'supertest';
import app from '../../app';
import User from '../user/user.model';
import Property from './property.model';
import { OwnershipEntity } from '../ownership-entity/ownership-entity.model';
import { generateAccessToken } from '../../utils/tokenManager';

describe('Property Module - Add New Property', () => {
  const createLandlordSession = async (email: string) => {
    const landlord = await User.create({
      firstName: 'Property Owner',
      email,
      password: 'PropertyPass123!',
      role: 'landlord',
      isVerified: true,
    });

    return {
      landlord,
      token: generateAccessToken(
        landlord._id.toString(),
        landlord.role,
        landlord.isVerified
      ),
    };
  };

  it('creates a property with every field shown in the Add New Property form', async () => {
    const { landlord, token } = await createLandlordSession('property-owner@example.com');
    const ownershipEntity = await OwnershipEntity.create({
      user: landlord._id,
      name: 'Personal Portfolio',
      type: 'personal',
    });

    const payload = {
      propertyName: 'Sunset Apartments',
      propertyType: 'flat_apartment',
      tenure: 'leasehold',
      squareFeet: 980,
      epcRating: 'B',
      bedrooms: 2,
      bathrooms: 2,
      streetAddress: '123 Property Lane',
      city: 'London',
      county: 'Greater London',
      postcode: 'SW1A 1AA',
      ownershipEntity: ownershipEntity._id.toString(),
      ownershipType: 'personal',
      ownershipPercentage: 100,
      purchaseDate: '2025-03-15',
      purchasePrice: 350000,
      monthlyMortgagePayment: 1450,
      stampDutyLandTax: 7500,
      legalFees: 1800,
      agentFees: 2500,
      initialRefurbishment: 12000,
      managementFeePercentage: 8.5,
      agentName: 'Alex Morgan',
      agentPhone: '+44 20 7946 0958',
      agentEmail: 'alex@example.com',
      companyAgencyName: 'London Property Management',
      insuranceProvider: 'Example Insurance',
      policyNumber: 'POL-123456',
      annualPremium: 850,
      coverageAmount: 500000,
      insuranceStartDate: '2025-03-15',
      renewalDate: '2026-03-15',
      propertyNotes: 'Two-bedroom flat near the station.',
    };

    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.property).toMatchObject({
      propertyName: payload.propertyName,
      propertyType: payload.propertyType,
      tenure: payload.tenure,
      squareFeet: payload.squareFeet,
      epcRating: payload.epcRating,
      bedrooms: payload.bedrooms,
      bathrooms: payload.bathrooms,
      ownership: {
        ownershipEntity: ownershipEntity._id.toString(),
        ownershipType: 'personal',
        ownershipPercentage: 100,
      },
      management: {
        managementFeePercentage: 8.5,
        agentName: payload.agentName,
        agentPhone: payload.agentPhone,
        agentEmail: payload.agentEmail,
        companyAgencyName: payload.companyAgencyName,
      },
      insurance: {
        insuranceProvider: payload.insuranceProvider,
        policyNumber: payload.policyNumber,
        annualPremium: payload.annualPremium,
        coverageAmount: payload.coverageAmount,
      },
    });
    expect(response.body.data.property.address).toEqual({
      streetAddress: payload.streetAddress,
      city: payload.city,
      county: payload.county,
      postcode: payload.postcode,
    });
    expect(response.body.data.property.additionalCosts.totalAdditionalCost).toBe(23800);
    expect(await Property.countDocuments({ landlordId: landlord._id })).toBe(1);
  });

  it('accepts multipart form-data and ignores empty optional number/date fields', async () => {
    const { token } = await createLandlordSession('multipart-owner@example.com');

    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .field('propertyName', 'Riverside Flat')
      .field('propertyType', 'flat_apartment')
      .field('tenure', 'freehold')
      .field('streetAddress', '45 River Road')
      .field('city', 'Manchester')
      .field('postcode', 'M1 1AE')
      .field('ownershipType', 'personal')
      .field('squareFeet', '')
      .field('purchaseDate', '')
      .field('annualPremium', '')
      .field('insuranceStartDate', '');

    expect(response.status).toBe(201);
    expect(response.body.data.property).toMatchObject({
      propertyName: 'Riverside Flat',
      propertyType: 'flat_apartment',
      tenure: 'freehold',
      ownership: { ownershipType: 'personal' },
    });
  });

  it('rejects an ownership entity belonging to another landlord', async () => {
    const { token } = await createLandlordSession('first-owner@example.com');
    const { landlord: otherLandlord } = await createLandlordSession('other-owner@example.com');
    const otherEntity = await OwnershipEntity.create({
      user: otherLandlord._id,
      name: 'Other Portfolio',
      type: 'personal',
    });

    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        propertyName: 'Invalid Ownership Property',
        propertyType: 'flat_apartment',
        tenure: 'freehold',
        streetAddress: '1 Example Street',
        city: 'London',
        postcode: 'E1 6AN',
        ownershipEntity: otherEntity._id.toString(),
        ownershipType: 'personal',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('does not belong to this landlord');
    expect(await Property.countDocuments()).toBe(0);
  });

  it('rejects a malformed ownership entity ID before saving', async () => {
    const { token } = await createLandlordSession('invalid-id-owner@example.com');

    const response = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        propertyName: 'Invalid ID Property',
        propertyType: 'flat_apartment',
        tenure: 'freehold',
        streetAddress: '2 Example Street',
        city: 'London',
        postcode: 'E1 6AN',
        ownershipEntity: 'Personal Portfolio',
        ownershipType: 'personal',
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toContain('Ownership entity must be a valid ID');
  });
});
