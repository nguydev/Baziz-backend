export type Region = 'england-ni' | 'wales' | 'scotland';
export type Regime = 'residential' | 'residential-ftb' | 'commercial';
export type RateStatus = 'active' | 'proposal' | 'archived';

export interface StampDutyBand {
  upTo: number; // Infinity can be represented by null or -1, but let's use -1 for Infinity
  rate: number;
}

export interface IStampDutyRateSet {
  region: Region;
  regime: Regime;
  status: RateStatus;
  bands: StampDutyBand[];
  surchargeRate: number; // e.g., 0.03 for 3% additional home surcharge
  version: number;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRateSetInput {
  region: Region;
  regime: Regime;
  bands: StampDutyBand[];
  surchargeRate: number;
  effectiveFrom?: Date;
}
