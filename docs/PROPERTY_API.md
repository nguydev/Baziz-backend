# Add New Property API

## Endpoint

`POST /api/v1/properties`

- Authentication: `Authorization: Bearer <accessToken>`
- Permission: landlord with `prop_create`
- Content type: `multipart/form-data` when uploading an image; JSON is also accepted without an image
- Image field: `propertyImage` (`jpeg`, `jpg`, `png`, or `webp`; maximum 5 MB)

## Form field mapping

| UI field | API field | Required | Value/type |
|---|---|---:|---|
| Property Name | `propertyName` | Yes | string |
| Property Type | `propertyType` | Yes | `detached_house`, `semi_detached_house`, `terraced_house`, `flat_apartment`, `bungalow`, `maisonette`, `studio`, `hmo`, `commercial`, `other` |
| Tenure | `tenure` | Yes | `freehold`, `leasehold`, `share_of_freehold` |
| Square Feet | `squareFeet` | No | non-negative number |
| EPC Rating | `epcRating` | No | `A` through `G` |
| Bedrooms | `bedrooms` | No | non-negative integer |
| Bathrooms | `bathrooms` | No | non-negative integer |
| Street Address | `streetAddress` | Yes | string |
| City/Town | `city` | Yes | string |
| County | `county` | No | string |
| Postcode | `postcode` | Yes | string |
| Ownership Entity | `ownershipEntity` | No | ID returned by `/api/v1/ownership-entities` |
| Ownership Type | `ownershipType` | No | `personal`, `sole`, `joint`, `company`, `trust` |
| Ownership % | `ownershipPercentage` | No | `0.01` to `100` |
| Purchase Date | `purchaseDate` | No | ISO date |
| Purchase Price | `purchasePrice` | No | non-negative number |
| Monthly Mortgage Payment | `monthlyMortgagePayment` | No | non-negative number |
| Stamp Duty Land Tax | `stampDutyLandTax` | No | non-negative number |
| Legal Fees | `legalFees` | No | non-negative number |
| Agent Fees | `agentFees` | No | non-negative number |
| Initial Refurbishment | `initialRefurbishment` | No | non-negative number |
| Management Fee | `managementFeePercentage` | No | `0` to `100` |
| Agent Name | `agentName` | No | string |
| Agent Phone | `agentPhone` | No | string |
| Agent Email | `agentEmail` | No | email |
| Company/Agency Name | `companyAgencyName` | No | string |
| Insurance Provider | `insuranceProvider` | No | string |
| Policy Number | `policyNumber` | No | string |
| Annual Premium | `annualPremium` | No | non-negative number |
| Coverage Amount | `coverageAmount` | No | non-negative number |
| Start Date | `insuranceStartDate` | No | ISO date |
| Renewal Date | `renewalDate` | No | ISO date |
| Property Notes | `propertyNotes` | No | string, maximum 2,000 characters |

Optional number and date fields may be omitted or sent as an empty multipart field. Use `null` to clear an optional date or ownership entity during an update.

## Example JSON request

```json
{
  "propertyName": "Sunset Apartments",
  "propertyType": "flat_apartment",
  "tenure": "leasehold",
  "squareFeet": 980,
  "epcRating": "B",
  "bedrooms": 2,
  "bathrooms": 2,
  "streetAddress": "123 Property Lane",
  "city": "London",
  "county": "Greater London",
  "postcode": "SW1A 1AA",
  "ownershipEntity": "<ownership-entity-object-id>",
  "ownershipType": "personal",
  "ownershipPercentage": 100,
  "purchaseDate": "2025-03-15",
  "purchasePrice": 350000,
  "monthlyMortgagePayment": 1450,
  "stampDutyLandTax": 7500,
  "legalFees": 1800,
  "agentFees": 2500,
  "initialRefurbishment": 12000,
  "managementFeePercentage": 8.5,
  "agentName": "Alex Morgan",
  "agentPhone": "+44 20 7946 0958",
  "agentEmail": "alex@example.com",
  "companyAgencyName": "London Property Management",
  "insuranceProvider": "Example Insurance",
  "policyNumber": "POL-123456",
  "annualPremium": 850,
  "coverageAmount": 500000,
  "insuranceStartDate": "2025-03-15",
  "renewalDate": "2026-03-15",
  "propertyNotes": "Two-bedroom flat near the station."
}
```

## Ownership entity flow

1. Load the dropdown with `GET /api/v1/ownership-entities`.
2. If needed, create "Personal Portfolio" with `POST /api/v1/ownership-entities` and body `{ "name": "Personal Portfolio", "type": "personal" }`.
3. Send the selected entity's MongoDB ID as `ownershipEntity`.

The API rejects ownership entities belonging to another landlord.
