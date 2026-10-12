/**
 * Landlord Portfolio Overview — dashboard card types
 */

export interface PortfolioCard {
  total: number;
  label: string;
  subtext: string;
}

export interface PortfolioPropertiesCard extends PortfolioCard {
  vacantUnits: number;
}

export interface PortfolioRentCollectedCard extends PortfolioCard {
  amount: number;
  currency: string;
  pendingPayments: number;
}

export interface PortfolioActiveTenantsCard extends PortfolioCard {
  occupiedUnits: number;
}

export interface PortfolioOverdueCard extends PortfolioCard {
  actionRequired: number;
}

export interface RecentPayment {
  name: string;
  date: string;
  amount: string;
}

export interface RevenueData {
  name: string;
  Revenue: number;
  Expenses: number;
}

export interface PortfolioAnalytics {
  occupancyRate: number;
  maintenanceCompletion: number;
  onTimeRent: number;
}

export interface PortfolioOverviewResult {
  properties: PortfolioPropertiesCard;
  rentCollected: PortfolioRentCollectedCard;
  activeTenants: PortfolioActiveTenantsCard;
  overdue: PortfolioOverdueCard;
  recentPayments: RecentPayment[];
  revenueByMonth: RevenueData[];
  analytics: PortfolioAnalytics;
}
