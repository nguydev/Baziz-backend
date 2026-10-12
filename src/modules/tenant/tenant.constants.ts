
export enum LeaseStatus {
  PENDING_ACCEPTANCE = 'pending_acceptance',
  ACCEPTED = 'accepted',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export enum PaymentFrequencyEnum {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum ParkingActionEnum {
  ADD = 'add',
  REMOVE = 'remove',
  UPDATE = 'update',
}

export const INVITATION_EXPIRY_DAYS = 7;

export const LEASE_STATUS_ACTIVE = [
  LeaseStatus.PENDING_ACCEPTANCE,
  LeaseStatus.ACCEPTED,
  LeaseStatus.ACTIVE,
];

export const LEASE_STATUS_PENDING = [LeaseStatus.PENDING_ACCEPTANCE];

export const LEASE_STATUS_EDITABLE = [LeaseStatus.PENDING_ACCEPTANCE, LeaseStatus.ACCEPTED];
