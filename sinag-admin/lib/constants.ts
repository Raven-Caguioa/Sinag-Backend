// lib/constants.ts
// Sinag Protocol Contract Configuration

// ============ PACKAGE IDs ============
// NEW package with yield distribution, coin type field, and investor tracking
export const PACKAGE_ID = "0x231694a62e54c1526a98cad24ad43eb6bcf8cf4326e30437e454e10498d15a79";

// OLD package (still valid for existing campaigns, but no new features)
export const OLD_PACKAGE_ID = "0x6d9a0ac9f9741f5e578a4e874010760ab2da7d558b7c4115174c631ee694b48e";

// ============ CORE OBJECT IDs ============
export const ADMIN_CAP = "0x297d4b9c13e11e59741b61ce8da319443eaa0257b5464941f8e53de7366ecb04";
export const REGISTRY = "0xb369681e3f2d933dbc5ccad2e854fa562884f6df258e5a2aa5fcb85dad373fc6";
export const DISPLAY = "0x640d639a3960b746dd3681cf96db7dbff0a5704870eafcdb56d976127ad6ea17";
export const PUBLISHER = "0xc041899956ebabf7bca6a911c0076b5a0494013801499020a0f72a68d03e07cd";
export const UPGRADE_CAP = "0x47f2949eaefd0bc01b1e2737b8e9883ba94a5fa63ebc2c38812a9d4f95520a54";

// ============ OBJECT TYPES ============
export const CAMPAIGN_TYPE_SUI = `${PACKAGE_ID}::campaign::Campaign<0x2::sui::SUI>`;
export const CAMPAIGN_TYPE_USDC = `${PACKAGE_ID}::campaign::Campaign<0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC>`;
export const NFT_TYPE = `${PACKAGE_ID}::campaign::ResortShareNFT`;
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::campaign::AdminCap`;
export const REGISTRY_TYPE = `${PACKAGE_ID}::campaign::CampaignRegistry`;

// ============ OLD PACKAGE TYPES (for backward compatibility) ============
export const OLD_CAMPAIGN_TYPE_SUI = `${OLD_PACKAGE_ID}::campaign::Campaign<0x2::sui::SUI>`;
export const OLD_CAMPAIGN_TYPE_USDC = `${OLD_PACKAGE_ID}::campaign::Campaign<0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC>`;
export const OLD_NFT_TYPE = `${OLD_PACKAGE_ID}::campaign::ResortShareNFT`;

// ============ EVENT TYPES ============
export const EVENT_CAMPAIGN_CREATED = `${PACKAGE_ID}::campaign::CampaignCreated`;
export const EVENT_SHARES_MINTED = `${PACKAGE_ID}::campaign::SharesMinted`;
export const EVENT_CAMPAIGN_COMPLETED = `${PACKAGE_ID}::campaign::CampaignCompleted`;
export const EVENT_CAMPAIGN_CLOSED = `${PACKAGE_ID}::campaign::CampaignManuallyClosed`;
export const EVENT_CAMPAIGN_FINALIZED = `${PACKAGE_ID}::campaign::CampaignFinalized`;
export const EVENT_FUNDS_WITHDRAWN = `${PACKAGE_ID}::campaign::FundsWithdrawn`;

// ============ NEW YIELD EVENT TYPES ============
export const EVENT_YIELD_ROUND_OPENED = `${PACKAGE_ID}::campaign::YieldRoundOpened`;
export const EVENT_YIELD_ROUND_CLOSED = `${PACKAGE_ID}::campaign::YieldRoundClosed`;
export const EVENT_YIELD_CLAIMED = `${PACKAGE_ID}::campaign::YieldClaimed`;

// ============ OLD PACKAGE EVENT TYPES (for backward compatibility) ============
export const OLD_EVENT_CAMPAIGN_CREATED = `${OLD_PACKAGE_ID}::campaign::CampaignCreated`;
export const OLD_EVENT_SHARES_MINTED = `${OLD_PACKAGE_ID}::campaign::SharesMinted`;
export const OLD_EVENT_CAMPAIGN_COMPLETED = `${OLD_PACKAGE_ID}::campaign::CampaignCompleted`;
export const OLD_EVENT_CAMPAIGN_CLOSED = `${OLD_PACKAGE_ID}::campaign::CampaignManuallyClosed`;
export const OLD_EVENT_CAMPAIGN_FINALIZED = `${OLD_PACKAGE_ID}::campaign::CampaignFinalized`;
export const OLD_EVENT_FUNDS_WITHDRAWN = `${OLD_PACKAGE_ID}::campaign::FundsWithdrawn`;

// ============ SUI NETWORK CONFIGURATION ============
export const NETWORK = "testnet"; // Change to "mainnet" for production
export const SUI_CLOCK = "0x0000000000000000000000000000000000000000000000000000000000000006";

// ============ CAMPAIGN STATUS CONSTANTS ============
export const STATUS_ACTIVE = 0;
export const STATUS_COMPLETED = 1;
export const STATUS_MANUALLY_CLOSED = 2;

// ============ COIN TYPES ============
export const SUI_TYPE = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
export const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"; // Testnet USDC

// ============ CONVERSION CONSTANTS ============
export const MIST_PER_SUI = 1_000_000_000;
export const MICRO_USDC_PER_USDC = 1_000_000;

// ============ VALIDATION CONSTANTS ============
export const MAX_APY_BPS = 10000; // 100%
export const MIN_APY_BPS = 1;
export const MIN_MATURITY_DAYS = 1;
export const MAX_IMAGES = 10;

// ============ ERROR MESSAGES ============
export const ERROR_MESSAGES = {
  NO_WALLET: "Please connect your wallet first",
  NOT_ADMIN: "You don't have admin privileges",
  INVALID_APY: `APY must be between ${MIN_APY_BPS} and ${MAX_APY_BPS} basis points`,
  INVALID_MATURITY: `Maturity must be at least ${MIN_MATURITY_DAYS} days`,
  INVALID_IMAGES: `Please provide at least 1 and at most ${MAX_IMAGES} images`,
  TRANSACTION_FAILED: "Transaction failed. Please try again.",
};

// ============ HELPER FUNCTIONS ============

/**
 * Get the correct package ID for a campaign object type
 */
export function getPackageFromType(objectType: string): string {
  if (objectType.includes(PACKAGE_ID)) return PACKAGE_ID;
  if (objectType.includes(OLD_PACKAGE_ID)) return OLD_PACKAGE_ID;
  return PACKAGE_ID; // Default to new package
}

/**
 * Check if an object is from the old package
 */
export function isOldPackage(objectType: string): boolean {
  return objectType.includes(OLD_PACKAGE_ID);
}

/**
 * Get coin type from campaign object type
 */
export function getCoinTypeFromObjectType(objectType: string): "SUI" | "USDC" {
  return objectType.includes("sui::SUI") ? "SUI" : "USDC";
}