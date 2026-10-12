const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'docs', 'postman');
fs.mkdirSync(outDir, { recursive: true });

const collectionPath = path.join(outDir, 'B-Aziz-Backend-Complete-API.postman_collection.json');
const envPath = path.join(outDir, 'B-Aziz-Local.postman_environment.json');

const rawUrl = (url) => {
  const variableMatch = url.match(/^({{[^}]+}})\/?(.*)$/);
  const hostVariable = variableMatch ? variableMatch[1] : '{{apiBase}}';
  const clean = variableMatch ? variableMatch[2] : url.replace(/^{{apiBase}}\//, '');
  return {
    raw: url,
    host: [hostVariable],
    path: clean.split('/').filter(Boolean),
  };
};

const bearerAuth = {
  type: 'bearer',
  bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
};

const jsonBody = (body) => ({
  mode: 'raw',
  raw: JSON.stringify(body, null, 2),
  options: { raw: { language: 'json' } },
});

const formDataBody = (fields) => ({
  mode: 'formdata',
  formdata: fields,
});

const testScript = (lines) => ({
  listen: 'test',
  script: { type: 'text/javascript', exec: lines },
});

const item = (name, method, url, options = {}) => {
  const headers = [];
  if (options.body && options.body.mode === 'raw') {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  return {
    name,
    event: options.tests ? [testScript(options.tests)] : undefined,
    request: {
      auth: options.noAuth ? { type: 'noauth' } : undefined,
      method,
      header: headers,
      body: options.body,
      url: rawUrl(url),
      description: options.description,
    },
  };
};

const folder = (name, items) => ({ name, item: items });

const saveSigninTokens = [
  "pm.test('Signin success', function () {",
  "  pm.response.to.have.status(200);",
  "  const body = pm.response.json();",
  "  const data = body.data || {};",
  "  const accessToken = data.accessToken || data.token || (data.tokens && data.tokens.accessToken);",
  "  const refreshToken = data.refreshToken || (data.tokens && data.tokens.refreshToken);",
  "  if (accessToken) pm.environment.set('accessToken', accessToken);",
  "  if (refreshToken) pm.environment.set('refreshToken', refreshToken);",
  "});",
];

const propertyFormFields = [
  { key: 'propertyImage', type: 'file', src: [], description: 'Optional JPEG, PNG, or WebP image; maximum 5 MB' },
  { key: 'propertyName', value: 'Sunset Apartments', type: 'text' },
  { key: 'propertyType', value: 'flat_apartment', type: 'text' },
  { key: 'tenure', value: 'leasehold', type: 'text' },
  { key: 'squareFeet', value: '980', type: 'text' },
  { key: 'epcRating', value: 'B', type: 'text' },
  { key: 'bedrooms', value: '2', type: 'text' },
  { key: 'bathrooms', value: '2', type: 'text' },
  { key: 'streetAddress', value: '123 Property Lane', type: 'text' },
  { key: 'city', value: 'London', type: 'text' },
  { key: 'county', value: 'Greater London', type: 'text' },
  { key: 'postcode', value: 'SW1A 1AA', type: 'text' },
  { key: 'ownershipEntity', value: '{{ownershipEntityId}}', type: 'text' },
  { key: 'ownershipType', value: 'personal', type: 'text' },
  { key: 'ownershipPercentage', value: '100', type: 'text' },
  { key: 'purchaseDate', value: '2025-03-15', type: 'text' },
  { key: 'purchasePrice', value: '350000', type: 'text' },
  { key: 'monthlyMortgagePayment', value: '1450', type: 'text' },
  { key: 'stampDutyLandTax', value: '7500', type: 'text' },
  { key: 'legalFees', value: '1800', type: 'text' },
  { key: 'agentFees', value: '2500', type: 'text' },
  { key: 'initialRefurbishment', value: '12000', type: 'text' },
  { key: 'managementFeePercentage', value: '8.5', type: 'text' },
  { key: 'agentName', value: 'Alex Morgan', type: 'text' },
  { key: 'agentPhone', value: '+44 20 7946 0958', type: 'text' },
  { key: 'agentEmail', value: 'alex@example.com', type: 'text' },
  { key: 'companyAgencyName', value: 'London Property Management', type: 'text' },
  { key: 'insuranceProvider', value: 'Example Insurance', type: 'text' },
  { key: 'policyNumber', value: 'POL-123456', type: 'text' },
  { key: 'annualPremium', value: '850', type: 'text' },
  { key: 'coverageAmount', value: '500000', type: 'text' },
  { key: 'insuranceStartDate', value: '2025-03-15', type: 'text' },
  { key: 'renewalDate', value: '2026-03-15', type: 'text' },
  { key: 'propertyNotes', value: 'Two-bedroom flat near the station.', type: 'text' },
];

const savePropertyId = [
  "pm.test('Property request completed', function () {",
  "  pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
  "  const body = pm.response.json();",
  "  const property = body.data && (body.data.property || body.data);",
  "  const id = property && (property.id || property._id);",
  "  if (id) pm.environment.set('propertyId', id);",
  "});",
];

const saveOwnershipEntityId = [
  "pm.test('Ownership entity saved', function () {",
  "  pm.expect(pm.response.code).to.be.oneOf([200, 201]);",
  "  const body = pm.response.json();",
  "  const data = body.data;",
  "  const entity = Array.isArray(data) ? data[0] : data;",
  "  const id = entity && (entity.id || entity._id);",
  "  if (id) pm.environment.set('ownershipEntityId', id);",
  "});",
];

const collection = {
  info: {
    _postman_id: 'b7c1f4d2-7e28-4a8e-a6d9-baziz-complete',
    name: 'B Aziz Backend - Complete API',
    description: 'Complete Postman collection generated from the B Aziz backend routes. Set apiBase and accessToken in the environment before running protected requests.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: bearerAuth,
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "if (!pm.environment.get('apiBase')) pm.environment.set('apiBase', 'http://localhost:5000/api/v1');",
        ],
      },
    },
  ],
  item: [
    folder('00 - System', [
      item('Health', 'GET', '{{apiBase}}/health', { noAuth: true }),
      item('Health Live', 'GET', '{{apiBase}}/health/live', { noAuth: true }),
      item('Health Ready', 'GET', '{{apiBase}}/health/ready', { noAuth: true }),
      item('Metrics', 'GET', '{{rootBase}}/metrics', { noAuth: true }),
      item('Dev Payment Config', 'GET', '{{apiBase}}/dev/payment-config', { noAuth: true }),
    ]),
    folder('01 - Authentication Flow', [
      item('Landlord Sign Up', 'POST', '{{apiBase}}/auth/signup', {
        noAuth: true,
        body: jsonBody({
          firstName: 'Postman Landlord',
          email: '{{landlordEmail}}',
          password: '{{landlordPassword}}',
          confirmPassword: '{{landlordPassword}}',
          role: 'landlord',
          termsAccepted: true,
        }),
      }),
      item('Tenant Sign Up', 'POST', '{{apiBase}}/auth/signup', {
        noAuth: true,
        body: jsonBody({
          firstName: 'Postman Tenant',
          email: '{{tenantEmail}}',
          password: '{{tenantPassword}}',
          confirmPassword: '{{tenantPassword}}',
          role: 'tenant',
          termsAccepted: true,
        }),
      }),
      item('Verify Email OTP', 'POST', '{{apiBase}}/auth/verify-email', { noAuth: true, body: jsonBody({ email: '{{landlordEmail}}', otp: '{{otp}}' }) }),
      item('Resend Verification OTP', 'POST', '{{apiBase}}/auth/resend-otp', { noAuth: true, body: jsonBody({ email: '{{landlordEmail}}' }) }),
      item('Landlord Sign In', 'POST', '{{apiBase}}/auth/signin', { noAuth: true, body: jsonBody({ email: '{{landlordEmail}}', password: '{{landlordPassword}}' }), tests: saveSigninTokens }),
      item('Tenant Sign In', 'POST', '{{apiBase}}/auth/signin', { noAuth: true, body: jsonBody({ email: '{{tenantEmail}}', password: '{{tenantPassword}}' }), tests: saveSigninTokens }),
      item('Forgot Password', 'POST', '{{apiBase}}/auth/forgot-password', { noAuth: true, body: jsonBody({ email: '{{landlordEmail}}' }) }),
      item('Verify Password-reset OTP', 'POST', '{{apiBase}}/auth/verify-otp', { noAuth: true, body: jsonBody({ email: '{{landlordEmail}}', otp: '{{otp}}' }) }),
      item('Reset Password', 'POST', '{{apiBase}}/auth/reset-password', { body: jsonBody({ newPassword: '{{landlordPassword}}', confirmPassword: '{{landlordPassword}}' }) }),
      item('Change Password', 'POST', '{{apiBase}}/auth/change-password', { body: jsonBody({ oldPassword: '{{landlordPassword}}', newPassword: '{{landlordPassword}}', confirmPassword: '{{landlordPassword}}' }) }),
      item('Refresh Token', 'POST', '{{apiBase}}/auth/refresh-token', { noAuth: true, body: jsonBody({ refreshToken: '{{refreshToken}}' }), tests: saveSigninTokens }),
      item('Current Auth User', 'GET', '{{apiBase}}/auth/me'),
      item('Logout', 'POST', '{{apiBase}}/auth/logout'),
    ]),
    folder('02 - Users & Profile', [
      item('Get My Profile', 'GET', '{{apiBase}}/users/me'),
      item('Update Profile', 'PATCH', '{{apiBase}}/users/me', { body: formDataBody([{ key: 'profilePhoto', type: 'file', src: [] }, { key: 'firstName', value: 'Postman', type: 'text' }, { key: 'lastName', value: 'User', type: 'text' }, { key: 'phone', value: '+447700900123', type: 'text' }]) }),
      item('Update Settings', 'PATCH', '{{apiBase}}/users/me/settings', { body: jsonBody({ language: 'en', currency: 'GBP', timezone: 'Europe/London' }) }),
      item('Update Notification Preferences', 'PATCH', '{{apiBase}}/users/me/notifications', { body: jsonBody({ email: true, push: true, sms: false }) }),
      item('Remove Avatar', 'DELETE', '{{apiBase}}/users/me/avatar'),
      item('Change Profile Password', 'PATCH', '{{apiBase}}/users/me/password', { body: jsonBody({ oldPassword: '{{landlordPassword}}', newPassword: '{{landlordPassword}}', confirmPassword: '{{landlordPassword}}' }) }),
      item('Deactivate Profile', 'DELETE', '{{apiBase}}/users/me/profile'),
      item('Delete My Data', 'DELETE', '{{apiBase}}/users/me/data'),
      item('Admin List Users', 'GET', '{{apiBase}}/users?page=1&limit=10'),
      item('Admin Get User', 'GET', '{{apiBase}}/users/{{userId}}'),
      item('Admin Delete User', 'DELETE', '{{apiBase}}/users/{{userId}}'),
    ]),
    folder('03 - Ownership Entities', [
      item('Create Personal Portfolio', 'POST', '{{apiBase}}/ownership-entities', { body: jsonBody({ name: 'Personal Portfolio', type: 'personal', description: 'Default personal property portfolio' }), tests: saveOwnershipEntityId }),
      item('List Ownership Entities', 'GET', '{{apiBase}}/ownership-entities', { tests: saveOwnershipEntityId }),
      item('Get Ownership Entity', 'GET', '{{apiBase}}/ownership-entities/{{ownershipEntityId}}'),
      item('Update Ownership Entity', 'PATCH', '{{apiBase}}/ownership-entities/{{ownershipEntityId}}', { body: jsonBody({ name: 'Personal Portfolio', description: 'Updated from Postman' }) }),
      item('Delete Ownership Entity', 'DELETE', '{{apiBase}}/ownership-entities/{{ownershipEntityId}}'),
    ]),
    folder('04 - Landlord Property Flow', [
      item('Add New Property - Full Form', 'POST', '{{apiBase}}/properties', { body: formDataBody(propertyFormFields), tests: savePropertyId }),
      item('Create Property - JSON Minimal', 'POST', '{{apiBase}}/properties', { body: jsonBody({ propertyName: 'Minimal Property', propertyType: 'flat_apartment', tenure: 'leasehold', streetAddress: '123 Property Lane', city: 'London', postcode: 'SW1A 1AA' }), tests: savePropertyId }),
      item('List My Properties', 'GET', '{{apiBase}}/properties?page=1&limit=10'),
      item('Marketplace Property Dropdown', 'GET', '{{apiBase}}/properties/mine'),
      item('Property Summary', 'GET', '{{apiBase}}/properties/summary'),
      item('Get Property', 'GET', '{{apiBase}}/properties/{{propertyId}}'),
      item('Get Current Tenants', 'GET', '{{apiBase}}/properties/{{propertyId}}/current-tenants'),
      item('Update Property', 'PATCH', '{{apiBase}}/properties/{{propertyId}}', { body: formDataBody([{ key: 'propertyName', value: 'Updated Sunset Apartments', type: 'text' }, { key: 'propertyImage', type: 'file', src: [] }]), tests: savePropertyId }),
      item('Add Unit', 'POST', '{{apiBase}}/properties/{{propertyId}}/units', { body: jsonBody({ unitNumber: 'A1', floor: '1', bedrooms: 2, bathrooms: 1, squareFeet: 650, rentAmount: 1500, totalParkingSpots: 1, notes: 'Front-facing unit' }) }),
      item('Delete Unit', 'DELETE', '{{apiBase}}/properties/{{propertyId}}/units/{{unitId}}'),
      item('Delete Property', 'DELETE', '{{apiBase}}/properties/{{propertyId}}'),
    ]),
    folder('05 - Property Expenses', [
      item('Create Expense', 'POST', '{{apiBase}}/properties/{{propertyId}}/expenses', { body: jsonBody({ title: 'Plumbing repair', category: 'maintenance', amount: 120, date: '2026-08-15', vendor: 'Local Plumber', notes: 'Kitchen sink repair' }) }),
      item('List Expenses', 'GET', '{{apiBase}}/properties/{{propertyId}}/expenses?page=1&limit=10'),
      item('Expense Report', 'GET', '{{apiBase}}/properties/{{propertyId}}/expenses/report?year=2026'),
      item('Get Expense', 'GET', '{{apiBase}}/properties/{{propertyId}}/expenses/{{expenseId}}'),
      item('Update Expense', 'PATCH', '{{apiBase}}/properties/{{propertyId}}/expenses/{{expenseId}}', { body: jsonBody({ amount: 150, notes: 'Updated cost' }) }),
      item('Delete Expense', 'DELETE', '{{apiBase}}/properties/{{propertyId}}/expenses/{{expenseId}}'),
    ]),
    folder('06 - Property Contacts', [
      item('Create Property Contact', 'POST', '{{apiBase}}/properties/{{propertyId}}/contacts', { body: jsonBody({ name: 'John Electrician', profession: 'electrician', phone: '+447700900111', email: 'john@example.com', notes: 'Preferred contractor' }) }),
      item('List Property Contacts', 'GET', '{{apiBase}}/properties/{{propertyId}}/contacts'),
      item('Get Property Contact', 'GET', '{{apiBase}}/properties/{{propertyId}}/contacts/{{contactId}}'),
      item('Update Property Contact', 'PATCH', '{{apiBase}}/properties/{{propertyId}}/contacts/{{contactId}}', { body: jsonBody({ notes: 'Updated note' }) }),
      item('Delete Property Contact', 'DELETE', '{{apiBase}}/properties/{{propertyId}}/contacts/{{contactId}}'),
    ]),
    folder('07 - Contacts', [
      item('Create Contact', 'POST', '{{apiBase}}/contacts', { body: jsonBody({ name: 'John Electrician', profession: 'electrician', phone: '+447700900111', email: 'john@example.com', company: 'John Repairs Ltd', notes: 'General contact' }) }),
      item('List Contacts', 'GET', '{{apiBase}}/contacts?page=1&limit=10'),
      item('Search Contacts', 'GET', '{{apiBase}}/contacts?search=electric'),
      item('Contact Stats', 'GET', '{{apiBase}}/contacts/stats'),
      item('Get Contact', 'GET', '{{apiBase}}/contacts/{{contactId}}'),
      item('Update Contact', 'PATCH', '{{apiBase}}/contacts/{{contactId}}', { body: jsonBody({ notes: 'Updated contact' }) }),
      item('Delete Contact', 'DELETE', '{{apiBase}}/contacts/{{contactId}}'),
    ]),
    folder('08 - Tenant & Lease Flow', [
      item('Invite Tenant', 'POST', '{{apiBase}}/tenants/invite', { body: jsonBody({ propertyId: '{{propertyId}}', unitId: '{{unitId}}', firstName: 'Postman', lastName: 'Tenant', email: '{{tenantEmail}}', rentAmount: 1500, leaseStartDate: '2026-09-01', leaseEndDate: '2027-08-31' }) }),
      item('Lease Preview', 'GET', '{{apiBase}}/tenants/lease-preview/{{leaseId}}', { noAuth: true }),
      item('Accept Invitation', 'POST', '{{apiBase}}/tenants/accept-invitation/{{leaseId}}', { noAuth: true, body: jsonBody({ firstName: 'Postman', lastName: 'Tenant', password: '{{tenantPassword}}', confirmPassword: '{{tenantPassword}}', termsAccepted: true }) }),
      item('My Lease', 'GET', '{{apiBase}}/tenants/my-lease'),
      item('My Property Documents', 'GET', '{{apiBase}}/tenants/my-property/documents'),
      item('My Tenants', 'GET', '{{apiBase}}/tenants/my-tenants'),
      item('Update Tenant Lease', 'PUT', '{{apiBase}}/tenants/{{leaseId}}', { body: jsonBody({ rentAmount: 1550, leaseEndDate: '2027-09-30' }) }),
      item('Resend Invitation', 'POST', '{{apiBase}}/tenants/{{leaseId}}/resend-invitation'),
      item('Delete Tenant Lease', 'DELETE', '{{apiBase}}/tenants/{{leaseId}}'),
      item('Get Unit Details', 'GET', '{{apiBase}}/tenants/properties/{{propertyId}}/units/{{unitId}}'),
      item('Update Parking Bays', 'PUT', '{{apiBase}}/tenants/properties/{{propertyId}}/units/{{unitId}}/parking', { body: jsonBody({ totalParkingSpots: 1, parkingBays: [{ bayNumber: 'P1', assignedTo: '{{leaseId}}' }] }) }),
      item('Allocate Parking Bay', 'POST', '{{apiBase}}/tenants/properties/{{propertyId}}/units/{{unitId}}/parking/allocate', { body: jsonBody({ bayNumber: 'P1', leaseId: '{{leaseId}}' }) }),
      item('Release Parking Bay', 'POST', '{{apiBase}}/tenants/properties/{{propertyId}}/units/{{unitId}}/parking/release', { body: jsonBody({ bayNumber: 'P1' }) }),
    ]),
    folder('09 - Monthly Bills', [
      item('Add Bill', 'POST', '{{apiBase}}/monthly-bills', { body: jsonBody({ billType: 'electricity', amount: 120, billingMonth: '2026-08', dueDate: '2026-08-31', notes: 'August bill' }) }),
      item('List Bills', 'GET', '{{apiBase}}/monthly-bills?page=1&limit=10'),
      item('Get Bill', 'GET', '{{apiBase}}/monthly-bills/{{billId}}'),
      item('Update Bill', 'PATCH', '{{apiBase}}/monthly-bills/{{billId}}', { body: jsonBody({ amount: 125, notes: 'Updated bill' }) }),
      item('Update Bill Status', 'PATCH', '{{apiBase}}/monthly-bills/{{billId}}/status', { body: jsonBody({ status: 'paid' }) }),
      item('Delete Bill', 'DELETE', '{{apiBase}}/monthly-bills/{{billId}}'),
    ]),
    folder('10 - Rent Payments', [
      item('Tenant Dashboard', 'GET', '{{apiBase}}/tenants/rent-payments/dashboard'),
      item('Tenant List Payments', 'GET', '{{apiBase}}/tenants/rent-payments'),
      item('Tenant Get Payment', 'GET', '{{apiBase}}/tenants/rent-payments/{{paymentId}}'),
      item('Create Payment Intent', 'POST', '{{apiBase}}/tenants/rent-payments/{{paymentId}}/pay', { body: jsonBody({ paymentMethod: 'card' }) }),
      item('Mock Payment Success', 'POST', '{{apiBase}}/tenants/rent-payments/{{paymentId}}/pay-mock'),
      item('Apple Pay Config', 'GET', '{{apiBase}}/tenants/rent-payments/apple-pay/config'),
      item('Apple Pay Payment', 'POST', '{{apiBase}}/tenants/rent-payments/{{paymentId}}/pay/apple-pay', { body: jsonBody({ token: '{{applePayToken}}' }) }),
      item('Rent Notifications', 'GET', '{{apiBase}}/tenants/rent-payments/notifications'),
      item('Mark Rent Notification Read', 'PATCH', '{{apiBase}}/tenants/rent-payments/notifications/{{notificationId}}/read'),
      item('Register Device Token', 'POST', '{{apiBase}}/tenants/rent-payments/device-token', { body: jsonBody({ token: '{{deviceToken}}', platform: 'ios' }) }),
      item('Get Auto Pay', 'GET', '{{apiBase}}/tenants/rent-payments/auto-pay'),
      item('Setup Auto Pay', 'POST', '{{apiBase}}/tenants/rent-payments/auto-pay/setup', { body: jsonBody({ paymentMethodId: '{{paymentMethodId}}' }) }),
      item('Confirm Auto Pay Setup', 'POST', '{{apiBase}}/tenants/rent-payments/auto-pay/confirm', { body: jsonBody({ setupIntentId: '{{setupIntentId}}' }) }),
      item('Update Auto Pay', 'PATCH', '{{apiBase}}/tenants/rent-payments/auto-pay', { body: jsonBody({ enabled: true }) }),
      item('Landlord Payment Summary', 'GET', '{{apiBase}}/landlord/rent-payments/summary'),
      item('Landlord Monthly Report', 'GET', '{{apiBase}}/landlord/rent-payments/report?month=2026-08'),
      item('Generate Bills', 'POST', '{{apiBase}}/landlord/rent-payments/generate-bills', { body: jsonBody({ month: '2026-08' }) }),
      item('Register Apple Pay Domain', 'POST', '{{apiBase}}/landlord/rent-payments/apple-pay/register-domain', { body: jsonBody({ domainName: 'example.com' }) }),
      item('Create Manual Payment', 'POST', '{{apiBase}}/landlord/rent-payments/manual', { body: jsonBody({ leaseId: '{{leaseId}}', amount: 1500, paidAt: '2026-08-15', method: 'bank_transfer', notes: 'Manual payment' }) }),
      item('List Landlord Payments', 'GET', '{{apiBase}}/landlord/rent-payments?page=1&limit=10'),
      item('Update Manual Payment', 'PATCH', '{{apiBase}}/landlord/rent-payments/{{paymentId}}', { body: jsonBody({ status: 'paid', notes: 'Updated manually' }) }),
    ]),
    folder('11 - Maintenance Requests', [
      item('Submit Request', 'POST', '{{apiBase}}/maintenance-requests', { body: formDataBody([{ key: 'photos', type: 'file', src: [] }, { key: 'propertyId', value: '{{propertyId}}', type: 'text' }, { key: 'unitId', value: '{{unitId}}', type: 'text' }, { key: 'title', value: 'Leaking tap', type: 'text' }, { key: 'description', value: 'Kitchen tap is leaking', type: 'text' }, { key: 'priority', value: 'medium', type: 'text' }]) }),
      item('List Requests', 'GET', '{{apiBase}}/maintenance-requests?page=1&limit=10'),
      item('Get Request', 'GET', '{{apiBase}}/maintenance-requests/{{requestId}}'),
      item('Update Request Status', 'PATCH', '{{apiBase}}/maintenance-requests/{{requestId}}/status', { body: jsonBody({ status: 'in_progress' }) }),
      item('Add Request Comment', 'POST', '{{apiBase}}/maintenance-requests/{{requestId}}/comments', { body: jsonBody({ message: 'Technician scheduled.' }) }),
      item('Delete Request', 'DELETE', '{{apiBase}}/maintenance-requests/{{requestId}}'),
    ]),
    folder('12 - Complaints', [
      item('Submit Complaint', 'POST', '{{apiBase}}/complaints', { body: jsonBody({ propertyId: '{{propertyId}}', title: 'Noise issue', description: 'Loud noise after midnight', category: 'noise' }) }),
      item('List Complaints', 'GET', '{{apiBase}}/complaints?page=1&limit=10'),
      item('Get Complaint', 'GET', '{{apiBase}}/complaints/{{complaintId}}'),
      item('Update Complaint Status', 'PATCH', '{{apiBase}}/complaints/{{complaintId}}/status', { body: jsonBody({ status: 'resolved', landlordResponse: 'Issue handled.' }) }),
      item('Delete Complaint', 'DELETE', '{{apiBase}}/complaints/{{complaintId}}'),
    ]),
    folder('13 - Documents', [
      item('Upload Global Document', 'POST', '{{apiBase}}/documents', { body: formDataBody([{ key: 'document', type: 'file', src: [] }, { key: 'title', value: 'Insurance Certificate', type: 'text' }, { key: 'category', value: 'insurance', type: 'text' }]) }),
      item('List Global Documents', 'GET', '{{apiBase}}/documents?page=1&limit=10'),
      item('Delete Global Document', 'DELETE', '{{apiBase}}/documents/{{documentId}}'),
      item('Upload Property Document', 'POST', '{{apiBase}}/properties/{{propertyId}}/documents', { body: formDataBody([{ key: 'document', type: 'file', src: [] }, { key: 'title', value: 'Gas Safety Certificate', type: 'text' }, { key: 'category', value: 'gas_safety', type: 'text' }]) }),
      item('List Property Documents', 'GET', '{{apiBase}}/properties/{{propertyId}}/documents'),
      item('Get Property Document', 'GET', '{{apiBase}}/properties/{{propertyId}}/documents/{{documentId}}'),
      item('Delete Property Document', 'DELETE', '{{apiBase}}/properties/{{propertyId}}/documents/{{documentId}}'),
    ]),
    folder('14 - Tasks', [
      item('Create Task', 'POST', '{{apiBase}}/tasks', { body: jsonBody({ title: 'Book inspection', description: 'Annual property inspection', priority: 'medium', dueDate: '2026-09-01', propertyId: '{{propertyId}}' }) }),
      item('List Tasks', 'GET', '{{apiBase}}/tasks?page=1&limit=10'),
      item('Task Stats', 'GET', '{{apiBase}}/tasks/stats'),
      item('Search Tasks', 'GET', '{{apiBase}}/tasks/search?q=inspection'),
      item('AI Task Suggestions', 'GET', '{{apiBase}}/tasks/ai-suggestions'),
      item('Get Task', 'GET', '{{apiBase}}/tasks/{{taskId}}'),
      item('Update Task', 'PATCH', '{{apiBase}}/tasks/{{taskId}}', { body: jsonBody({ status: 'in_progress' }) }),
      item('Complete Task', 'PATCH', '{{apiBase}}/tasks/{{taskId}}/complete'),
      item('Delete Task', 'DELETE', '{{apiBase}}/tasks/{{taskId}}'),
    ]),
    folder('15 - Chat', [
      item('List Conversations', 'GET', '{{apiBase}}/chat/conversations'),
      item('Create Direct Conversation', 'POST', '{{apiBase}}/chat/conversations/direct', { body: jsonBody({ participantId: '{{userId}}' }) }),
      item('Create Group Conversation', 'POST', '{{apiBase}}/chat/conversations/group', { body: jsonBody({ name: 'Property Team', memberIds: ['{{userId}}'] }) }),
      item('Create Support Conversation', 'POST', '{{apiBase}}/chat/conversations/support', { body: jsonBody({ subject: 'Need help', message: 'Hello support' }) }),
      item('Tenant Default Conversation', 'GET', '{{apiBase}}/chat/tenant/default-conversation'),
      item('Get Conversation', 'GET', '{{apiBase}}/chat/conversations/{{conversationId}}'),
      item('Update Conversation', 'PATCH', '{{apiBase}}/chat/conversations/{{conversationId}}', { body: jsonBody({ name: 'Updated Conversation' }) }),
      item('Archive Conversation', 'DELETE', '{{apiBase}}/chat/conversations/{{conversationId}}'),
      item('Manage Members', 'POST', '{{apiBase}}/chat/conversations/{{conversationId}}/members', { body: jsonBody({ action: 'add', memberIds: ['{{userId}}'] }) }),
      item('List Messages', 'GET', '{{apiBase}}/chat/conversations/{{conversationId}}/messages'),
      item('Send Message', 'POST', '{{apiBase}}/chat/conversations/{{conversationId}}/messages', { body: jsonBody({ text: 'Hello from Postman' }) }),
      item('Mark Conversation Read', 'POST', '{{apiBase}}/chat/conversations/{{conversationId}}/read'),
      item('Edit Message', 'PATCH', '{{apiBase}}/chat/messages/{{messageId}}', { body: jsonBody({ text: 'Updated message' }) }),
      item('Delete Message', 'DELETE', '{{apiBase}}/chat/messages/{{messageId}}'),
      item('Add Reaction', 'POST', '{{apiBase}}/chat/messages/{{messageId}}/reactions', { body: jsonBody({ emoji: 'like' }) }),
      item('Remove Reaction', 'DELETE', '{{apiBase}}/chat/messages/{{messageId}}/reactions'),
      item('Create Media Upload URL', 'POST', '{{apiBase}}/chat/media/upload-url', { body: jsonBody({ fileName: 'photo.png', contentType: 'image/png' }) }),
      item('Confirm Media Upload', 'POST', '{{apiBase}}/chat/media/confirm', { body: jsonBody({ key: '{{mediaKey}}', url: '{{mediaUrl}}' }) }),
    ]),
    folder('16 - Marketplace', [
      item('Browse Listings', 'GET', '{{apiBase}}/marketplace/listings?page=1&limit=10', { noAuth: true }),
      item('Browse Joint Ventures', 'GET', '{{apiBase}}/marketplace/joint-ventures?page=1&limit=10', { noAuth: true }),
      item('Get Listing', 'GET', '{{apiBase}}/marketplace/listings/{{listingId}}', { noAuth: true }),
      item('Marketplace Upload URL', 'POST', '{{apiBase}}/marketplace/media/upload-url', { body: jsonBody({ fileName: 'property.png', contentType: 'image/png' }) }),
      item('Estimate Valuation', 'POST', '{{apiBase}}/marketplace/valuations/estimate', { body: jsonBody({ postcode: 'SW1A 1AA', propertyType: 'flat_apartment', bedrooms: 2 }) }),
      item('Toggle Saved Item', 'POST', '{{apiBase}}/marketplace/saved/{{listingId}}?type=listing'),
      item('Create Listing Inquiry', 'POST', '{{apiBase}}/marketplace/listings/{{listingId}}/inquiry', { body: jsonBody({ message: 'I am interested in this listing.' }) }),
      item('Create Portfolio Listing', 'POST', '{{apiBase}}/marketplace/listings/portfolio', { body: formDataBody([{ key: 'image', type: 'file', src: [] }, { key: 'propertyId', value: '{{propertyId}}', type: 'text' }, { key: 'title', value: 'Portfolio Listing', type: 'text' }, { key: 'askingPrice', value: '450000', type: 'text' }]) }),
      item('Create New Property Listing', 'POST', '{{apiBase}}/marketplace/listings/new-property', { body: formDataBody([{ key: 'image', type: 'file', src: [] }, { key: 'title', value: 'New Property Opportunity', type: 'text' }, { key: 'postcode', value: 'SW1A 1AA', type: 'text' }, { key: 'askingPrice', value: '450000', type: 'text' }]) }),
      item('Create Joint Venture', 'POST', '{{apiBase}}/marketplace/joint-ventures', { body: formDataBody([{ key: 'image', type: 'file', src: [] }, { key: 'title', value: 'Joint Venture Project', type: 'text' }, { key: 'targetRaise', value: '100000', type: 'text' }]) }),
      item('Update Listing', 'PATCH', '{{apiBase}}/marketplace/listings/{{listingId}}', { body: formDataBody([{ key: 'title', value: 'Updated Listing', type: 'text' }, { key: 'image', type: 'file', src: [] }]) }),
      item('Delete Listing', 'DELETE', '{{apiBase}}/marketplace/listings/{{listingId}}'),
      item('Update Joint Venture', 'PATCH', '{{apiBase}}/marketplace/joint-ventures/{{jointVentureId}}', { body: formDataBody([{ key: 'title', value: 'Updated JV', type: 'text' }, { key: 'image', type: 'file', src: [] }]) }),
      item('Delete Joint Venture', 'DELETE', '{{apiBase}}/marketplace/joint-ventures/{{jointVentureId}}'),
    ]),
    folder('17 - Billing', [
      item('List Plans', 'GET', '{{apiBase}}/billing/plans'),
      item('Get Subscription', 'GET', '{{apiBase}}/billing/subscription'),
      item('Get Usage', 'GET', '{{apiBase}}/billing/usage'),
      item('Create Checkout', 'POST', '{{apiBase}}/billing/checkout', { body: jsonBody({ planId: 'pro', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' }) }),
      item('Create Portal', 'POST', '{{apiBase}}/billing/portal', { body: jsonBody({ returnUrl: 'https://example.com/account' }) }),
      item('Downgrade Plan', 'POST', '{{apiBase}}/billing/downgrade', { body: jsonBody({ planId: 'free' }) }),
      item('Update Billing Info', 'PATCH', '{{apiBase}}/billing/info', { body: jsonBody({ billingEmail: '{{landlordEmail}}', billingAddress: '123 Billing Street, London' }) }),
      item('List Invoices', 'GET', '{{apiBase}}/billing/invoices?page=1&limit=10'),
      item('Get Invoice', 'GET', '{{apiBase}}/billing/invoices/{{invoiceId}}'),
    ]),
    folder('18 - Team & Permissions', [
      item('Accept Team Invite', 'POST', '{{apiBase}}/team/members/accept-invite', { noAuth: true, body: jsonBody({ token: '{{teamInviteToken}}', password: '{{landlordPassword}}', confirmPassword: '{{landlordPassword}}' }) }),
      item('List Permissions', 'GET', '{{apiBase}}/team/permissions'),
      item('List Roles', 'GET', '{{apiBase}}/team/roles'),
      item('Create Role', 'POST', '{{apiBase}}/team/roles', { body: jsonBody({ name: 'Property Manager', permissions: ['prop_view', 'prop_edit'] }) }),
      item('Update Role', 'PATCH', '{{apiBase}}/team/roles/{{roleId}}', { body: jsonBody({ name: 'Senior Property Manager' }) }),
      item('Delete Role', 'DELETE', '{{apiBase}}/team/roles/{{roleId}}'),
      item('List Members', 'GET', '{{apiBase}}/team/members'),
      item('Invite Member', 'POST', '{{apiBase}}/team/members/invite', { body: jsonBody({ email: '{{memberEmail}}', roleId: '{{roleId}}' }) }),
      item('Update Member Role', 'PATCH', '{{apiBase}}/team/members/{{memberId}}/role', { body: jsonBody({ roleId: '{{roleId}}' }) }),
      item('Remove Member', 'DELETE', '{{apiBase}}/team/members/{{memberId}}'),
      item('List Project Members', 'GET', '{{apiBase}}/team/projects/{{projectId}}/members'),
      item('Assign Project Member', 'POST', '{{apiBase}}/team/projects/{{projectId}}/members', { body: jsonBody({ memberId: '{{memberId}}' }) }),
      item('Remove Project Member', 'DELETE', '{{apiBase}}/team/projects/{{projectId}}/members/{{memberId}}'),
    ]),
    folder('19 - Calculators', [
      item('Get Shared Calculation', 'GET', '{{apiBase}}/calculators/shared/{{shareToken}}', { noAuth: true }),
      item('Save Calculation', 'POST', '{{apiBase}}/calculators', { body: jsonBody({ name: 'Stamp Duty Scenario', type: 'stamp_duty', input: { price: 350000 }, result: { tax: 7500 } }) }),
      item('List Saved Calculations', 'GET', '{{apiBase}}/calculators'),
      item('Update Calculation', 'PATCH', '{{apiBase}}/calculators/{{calculationId}}', { body: jsonBody({ name: 'Updated Scenario' }) }),
      item('Delete Calculation', 'DELETE', '{{apiBase}}/calculators/{{calculationId}}'),
      item('Enable Sharing', 'POST', '{{apiBase}}/calculators/{{calculationId}}/share'),
      item('Disable Sharing', 'DELETE', '{{apiBase}}/calculators/{{calculationId}}/share'),
    ]),
    folder('20 - Stamp Duty', [
      item('Get Active Rates', 'GET', '{{apiBase}}/stamp-duty/rates/active', { noAuth: true }),
      item('Create Rate Proposal', 'POST', '{{apiBase}}/stamp-duty/rates', { body: jsonBody({ effectiveFrom: '2026-09-01', rates: [] }) }),
      item('Get All Rate Sets', 'GET', '{{apiBase}}/stamp-duty/rates'),
      item('Approve Proposal', 'PATCH', '{{apiBase}}/stamp-duty/rates/{{rateSetId}}/approve'),
      item('Revert Active Rate', 'PATCH', '{{apiBase}}/stamp-duty/rates/{{rateSetId}}/revert'),
    ]),
    folder('21 - AI', [
      item('AI Chat', 'POST', '{{apiBase}}/ai/chat', { body: jsonBody({ message: 'Summarize my property portfolio', includeNews: false }) }),
      item('Transcribe Audio', 'POST', '{{apiBase}}/ai/transcribe', { body: jsonBody({ audioBase64: '{{audioBase64}}', mimeType: 'audio/webm' }) }),
      item('CGT Rates', 'GET', '{{apiBase}}/ai/tax-rates/cgt'),
      item('IHT Rates', 'GET', '{{apiBase}}/ai/tax-rates/iht'),
    ]),
    folder('22 - Property Alerts', [
      item('Create Alert Config', 'POST', '{{apiBase}}/property-alerts/configs', { body: jsonBody({ propertyId: '{{propertyId}}', type: 'gas_safety', enabled: true, leadDays: 30 }) }),
      item('List Alert Configs', 'GET', '{{apiBase}}/property-alerts/configs'),
      item('Toggle Alert Config', 'PATCH', '{{apiBase}}/property-alerts/configs/{{alertConfigId}}/toggle'),
      item('Send Live Notification', 'POST', '{{apiBase}}/property-alerts/notifications/send-live', { body: jsonBody({ propertyId: '{{propertyId}}', title: 'Reminder', message: 'Certificate expiring soon' }) }),
      item('List Notifications', 'GET', '{{apiBase}}/property-alerts/notifications'),
      item('Mark Notification Read', 'PATCH', '{{apiBase}}/property-alerts/notifications/{{notificationId}}/read'),
      item('Delete Notification', 'DELETE', '{{apiBase}}/property-alerts/notifications/{{notificationId}}'),
    ]),
    folder('23 - Landlord Dashboard', [
      item('Portfolio Overview', 'GET', '{{apiBase}}/landlord/portfolio-overview'),
    ]),
  ],
};

const environment = {
  id: '2e86c87b-e4b1-4a29-90d5-f95853e58e66',
  name: 'B Aziz Local',
  values: [
    { key: 'rootBase', value: 'http://localhost:5000', type: 'default', enabled: true },
    { key: 'apiBase', value: 'http://localhost:5000/api/v1', type: 'default', enabled: true },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
    { key: 'refreshToken', value: '', type: 'secret', enabled: true },
    { key: 'landlordEmail', value: 'landlord.postman@example.com', type: 'default', enabled: true },
    { key: 'landlordPassword', value: 'Password@123', type: 'secret', enabled: true },
    { key: 'tenantEmail', value: 'tenant.postman@example.com', type: 'default', enabled: true },
    { key: 'tenantPassword', value: 'Password@123', type: 'secret', enabled: true },
    { key: 'memberEmail', value: 'member.postman@example.com', type: 'default', enabled: true },
    { key: 'otp', value: '123456', type: 'default', enabled: true },
    { key: 'ownershipEntityId', value: '', type: 'default', enabled: true },
    { key: 'propertyId', value: '', type: 'default', enabled: true },
    { key: 'unitId', value: '', type: 'default', enabled: true },
    { key: 'leaseId', value: '', type: 'default', enabled: true },
    { key: 'userId', value: '', type: 'default', enabled: true },
    { key: 'contactId', value: '', type: 'default', enabled: true },
    { key: 'expenseId', value: '', type: 'default', enabled: true },
    { key: 'billId', value: '', type: 'default', enabled: true },
    { key: 'paymentId', value: '', type: 'default', enabled: true },
    { key: 'requestId', value: '', type: 'default', enabled: true },
    { key: 'complaintId', value: '', type: 'default', enabled: true },
    { key: 'documentId', value: '', type: 'default', enabled: true },
    { key: 'taskId', value: '', type: 'default', enabled: true },
    { key: 'conversationId', value: '', type: 'default', enabled: true },
    { key: 'messageId', value: '', type: 'default', enabled: true },
    { key: 'listingId', value: '', type: 'default', enabled: true },
    { key: 'jointVentureId', value: '', type: 'default', enabled: true },
    { key: 'invoiceId', value: '', type: 'default', enabled: true },
    { key: 'roleId', value: '', type: 'default', enabled: true },
    { key: 'memberId', value: '', type: 'default', enabled: true },
    { key: 'projectId', value: '', type: 'default', enabled: true },
    { key: 'calculationId', value: '', type: 'default', enabled: true },
    { key: 'shareToken', value: '', type: 'default', enabled: true },
    { key: 'rateSetId', value: '', type: 'default', enabled: true },
    { key: 'alertConfigId', value: '', type: 'default', enabled: true },
    { key: 'notificationId', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'Codex',
};

const stripUndefined = (value) => {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
};

fs.writeFileSync(collectionPath, JSON.stringify(stripUndefined(collection), null, 2));
fs.writeFileSync(envPath, JSON.stringify(environment, null, 2));

const countItems = (items) =>
  items.reduce((total, current) => total + (current.item ? countItems(current.item) : 1), 0);

console.log(`Wrote ${collectionPath}`);
console.log(`Wrote ${envPath}`);
console.log(`Folders: ${collection.item.length}`);
console.log(`Requests: ${countItems(collection.item)}`);
