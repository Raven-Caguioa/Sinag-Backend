// lib/types.ts
// TypeScript types for Sinag Protocol

export interface Campaign {
  id: string;
  campaign_number: string;
  name: string;
  description: string;
  location: string;
  target_apy: string;
  maturity_days: string;
  maturity_date: string;
  structure: string;
  price_per_share: string;
  total_supply: string;
  shares_sold: string;
  resort_images: string[];
  nft_image: string;
  due_diligence_url: string | null;
  balance: string;
  status: number;
  is_finalized: boolean;
  created_at: string;
  closed_at: string | null;
  coin_type: "SUI" | "USDC";
  
  // NEW FIELDS (may be undefined for old package campaigns)
  unique_investors?: string;
  current_round?: string;
  total_yield_distributed?: string;
}

export interface YieldRound {
  round_number: string;
  yield_per_share: string;
  total_deposited: string;
  total_claimed: string;
  claimed_shares: string;
  is_active: boolean;
  opened_at: string;
  closed_at: string | null;
}

export interface ResortShareNFT {
  id: string;
  campaign_id: string;
  campaign_name: string;
  location: string;
  issue_number: string;
  nft_image: string;
  target_apy: string;
  maturity_date: string;
  structure: string;
  minted_at: string;
  
  // NEW FIELD (may be undefined for old package NFTs)
  last_claimed_round?: string;
}

export interface CreateCampaignForm {
  name: string;
  description: string;
  location: string;
  target_apy: number;
  maturity_days: number;
  structure: string;
  price_per_share: number;
  total_supply: number;
  resort_images: string[];
  nft_image: string;
  due_diligence_url: string;
  coin_type: "SUI" | "USDC";
}

export interface CampaignEvent {
  campaign_id: string;
  campaign_number?: string;
  name?: string;
  location?: string;
  total_raised?: string;
  shares_sold?: string;
  remaining_shares?: string;
  timestamp: string;
  
  // NEW: For SharesMinted event
  is_new_investor?: boolean;
}

export interface YieldRoundOpenedEvent {
  campaign_id: string;
  round_number: string;
  yield_per_share: string;
  total_deposited: string;
  timestamp: string;
}

export interface YieldRoundClosedEvent {
  campaign_id: string;
  round_number: string;
  total_claimed: string;
  total_deposited: string;
  unclaimed_shares: string;
  timestamp: string;
}

export interface YieldClaimedEvent {
  campaign_id: string;
  nft_id: string;
  round_number: string;
  amount: string;
  claimer: string;
  timestamp: string;
}

export interface TransactionResult {
  success: boolean;
  digest?: string;
  error?: string;
}

export interface AdminStats {
  total_campaigns: number;
  active_campaigns: number;
  total_raised_sui: string;
  total_raised_usdc: string;
  
  // NEW STATS
  total_investors?: number;
  total_yield_distributed_sui?: string;
  total_yield_distributed_usdc?: string;
}

// Helper type for campaigns that support yield (new package only)
export type YieldEnabledCampaign = Campaign & {
  unique_investors: string;
  current_round: string;
  total_yield_distributed: string;
};

// Type guard to check if campaign supports yield
export function isYieldEnabledCampaign(campaign: Campaign): campaign is YieldEnabledCampaign {
  return campaign.unique_investors !== undefined &&
         campaign.current_round !== undefined &&
         campaign.total_yield_distributed !== undefined;
}