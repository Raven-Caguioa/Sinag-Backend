// lib/constants.ts
// Sinag Protocol Contract Configuration

// ============ PACKAGE IDs ============
// NEW package from your recent deployment (0x9c43...)
export const PACKAGE_ID = "0x9c432006d3068f23371320f64c6f2eb3db8b2624c0cbb155eb2274b012eeab8a";

// OLD package (The previous active package 0x745d...)
export const OLD_PACKAGE_ID = "0x745d9b84dd990aed04c0a2202b8d34fa3c74f7e2ca708543425bfe66d4160fbf";

// ============ CORE OBJECT IDs ============
// Extracted from your provided transaction data
export const ADMIN_CAP = "0x5c71c1bf7a0f396049da2227536ee015e9a57a2ac3d42609326b1a8190ea1fb3";
export const REGISTRY = "0x1953836ed6f9358e9af05f656f7319549c5f2e37eaa9ccf3340660a90dfe6b90";
export const DISPLAY = "0x9d5b4a06a2afcdbbfeabe3ddaf0cfa363632fa248b992c00caed5f13fe26e197";
export const PUBLISHER = "0xb45c8ba094d73125949f5505510e37fe3cf996a2d9308b80be772bae1df4f85e";
export const UPGRADE_CAP = "0x1e4432f319329a8ae870639fe61c33ec59e984a00a5cdb65be4fc65a80fb29f0";

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