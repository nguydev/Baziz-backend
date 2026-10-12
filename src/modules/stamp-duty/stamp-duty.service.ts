import StampDutyRateSet from './stamp-duty.model';
import type { IStampDutyRateSetDocument } from './stamp-duty.model';
import type { CreateRateSetInput } from './stamp-duty.types';
import ApiError from '../../utils/ApiError';

export const getActiveRates = async (): Promise<IStampDutyRateSetDocument[]> => {
  return StampDutyRateSet.find({ status: 'active' });
};

export const createProposal = async (
  input: CreateRateSetInput
): Promise<IStampDutyRateSetDocument> => {
  const latest = await StampDutyRateSet.findOne({ region: input.region, regime: input.regime })
    .sort({ version: -1 })
    .exec();

  const nextVersion = latest ? latest.version + 1 : 1;

  const rateSet = new StampDutyRateSet({
    ...input,
    status: 'proposal',
    version: nextVersion,
  });

  return rateSet.save();
};

export const approveProposal = async (
  id: string
): Promise<IStampDutyRateSetDocument> => {
  const proposal = await StampDutyRateSet.findById(id);
  if (!proposal) {
    throw ApiError.notFound('Rate set not found');
  }
  if (proposal.status === 'active') {
    throw ApiError.badRequest('Rate set is already active');
  }

  // Archive currently active one for this region/regime
  await StampDutyRateSet.updateMany(
    { region: proposal.region, regime: proposal.regime, status: 'active' },
    { $set: { status: 'archived' } }
  );

  // Set this to active
  proposal.status = 'active';
  return proposal.save();
};

// Seed function if none exist (for initial setup)
export const seedInitialRatesIfEmpty = async () => {
  const count = await StampDutyRateSet.countDocuments();
  if (count === 0) {
    // England & NI Residential
    await createProposal({
      region: 'england-ni',
      regime: 'residential',
      surchargeRate: 0.03,
      bands: [
        { upTo: 250000, rate: 0 },
        { upTo: 925000, rate: 0.05 },
        { upTo: 1500000, rate: 0.10 },
        { upTo: -1, rate: 0.12 },
      ]
    }).then(p => approveProposal(p._id.toString()));

    // Wales Residential
    await createProposal({
      region: 'wales',
      regime: 'residential',
      surchargeRate: 0.04,
      bands: [
        { upTo: 225000, rate: 0 },
        { upTo: 400000, rate: 0.06 },
        { upTo: 750000, rate: 0.075 },
        { upTo: 1500000, rate: 0.10 },
        { upTo: -1, rate: 0.12 },
      ]
    }).then(p => approveProposal(p._id.toString()));

    // Scotland Residential
    await createProposal({
      region: 'scotland',
      regime: 'residential',
      surchargeRate: 0.06,
      bands: [
        { upTo: 145000, rate: 0 },
        { upTo: 250000, rate: 0.02 },
        { upTo: 325000, rate: 0.05 },
        { upTo: 750000, rate: 0.10 },
        { upTo: -1, rate: 0.12 },
      ]
    }).then(p => approveProposal(p._id.toString()));

    // England & NI First Time Buyer (Relief applies to £625k, up to £425k is 0%, rest is 5%)
    await createProposal({
      region: 'england-ni',
      regime: 'residential-ftb',
      surchargeRate: 0.03,
      bands: [
        { upTo: 425000, rate: 0 },
        { upTo: 625000, rate: 0.05 },
        { upTo: -1, rate: 0.12 }, // falls back to standard top rate if exceeded
      ]
    }).then(p => approveProposal(p._id.toString()));

    // England & NI Commercial
    await createProposal({
      region: 'england-ni',
      regime: 'commercial',
      surchargeRate: 0,
      bands: [
        { upTo: 150000, rate: 0 },
        { upTo: 250000, rate: 0.02 },
        { upTo: -1, rate: 0.05 },
      ]
    }).then(p => approveProposal(p._id.toString()));

    // Wales Commercial
    await createProposal({
      region: 'wales',
      regime: 'commercial',
      surchargeRate: 0,
      bands: [
        { upTo: 225000, rate: 0 },
        { upTo: 250000, rate: 0.01 },
        { upTo: 1000000, rate: 0.05 },
        { upTo: -1, rate: 0.06 },
      ]
    }).then(p => approveProposal(p._id.toString()));

    // Scotland Commercial
    await createProposal({
      region: 'scotland',
      regime: 'commercial',
      surchargeRate: 0,
      bands: [
        { upTo: 150000, rate: 0 },
        { upTo: 250000, rate: 0.01 },
        { upTo: -1, rate: 0.05 },
      ]
    }).then(p => approveProposal(p._id.toString()));
  }
};

export const getAllRateSets = async (
  filter: any,
  page: number,
  limit: number
): Promise<{ rates: IStampDutyRateSetDocument[]; totalItems: number }> => {
  const skip = (page - 1) * limit;
  const totalItems = await StampDutyRateSet.countDocuments(filter);
  const rates = await StampDutyRateSet.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
  return { rates, totalItems };
};

export const revertActiveRateSet = async (id: string): Promise<IStampDutyRateSetDocument> => {
  const activeRateSet = await StampDutyRateSet.findById(id);
  if (!activeRateSet) {
    throw ApiError.notFound('Rate set not found');
  }
  if (activeRateSet.status !== 'active') {
    throw ApiError.badRequest('Can only revert active rate sets');
  }

  const previous = await StampDutyRateSet.findOne({
    region: activeRateSet.region,
    regime: activeRateSet.regime,
    status: 'archived',
    version: activeRateSet.version - 1
  });

  if (!previous) {
    throw ApiError.badRequest('No previous version found to revert to');
  }

  activeRateSet.status = 'archived';
  await activeRateSet.save();

  previous.status = 'active';
  return previous.save();
};
