/// Sinag - Real World Asset Resort Financing Platform
/// 
/// This module implements a sequential, single-campaign RWA fundraising system
/// where resort developments are fractionalized into NFT shares.
module sinag::campaign {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::display;
    use sui::package;
    use std::string::{Self, String};

    // ==================== Error Codes ====================
    
    const ENotAuthorized: u64 = 1;
    const ECampaignNotActive: u64 = 2;
    const ECampaignStillActive: u64 = 3;
    const EInsufficientShares: u64 = 4;
    const EIncorrectPayment: u64 = 5;
    const ENoFundsToWithdraw: u64 = 6;
    const EActiveCampaignExists: u64 = 7;
    const ECampaignNotFinalized: u64 = 8;
    const EInvalidShareAmount: u64 = 9;
    const ECampaignAlreadyFinalized: u64 = 10;

    // ==================== Campaign Status ====================
    
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_COMPLETED: u8 = 1;      // Sold out
    const STATUS_MANUALLY_CLOSED: u8 = 2; // Closed before sellout

    // ==================== Core Structures ====================

    /// One-Time-Witness for creating Display
    public struct CAMPAIGN has drop {}

    /// Administrative capability - holder can manage campaigns
    public struct AdminCap has key, store {
        id: UID
    }

    /// Global registry tracking the current active campaign
    public struct CampaignRegistry has key {
        id: UID,
        active_campaign_id: Option<ID>,
        campaign_count: u64
    }

    /// Represents a single resort development fundraising campaign
    public struct Campaign has key, store {
        id: UID,
        campaign_number: u64,
        name: String,
        description: String,
        walrus_blob_id: String,
        price_per_share: u64,
        total_supply: u64,
        shares_sold: u64,
        status: u8,
        balance: Balance<SUI>,
        is_finalized: bool,
        created_at: u64,
        closed_at: Option<u64>
    }

    /// NFT representing fractional ownership of a resort development
    public struct ResortShareNFT has key, store {
        id: UID,
        campaign_id: ID,
        campaign_name: String,
        issue_number: u64,
        blob_id: String,
        minted_at: u64
    }

    // ==================== Events ====================

    public struct CampaignCreated has copy, drop {
        campaign_id: ID,
        campaign_number: u64,
        name: String,
        price_per_share: u64,
        total_supply: u64,
        created_at: u64
    }

    public struct SharesMinted has copy, drop {
        campaign_id: ID,
        buyer: address,
        quantity: u64,
        issue_numbers: vector<u64>,
        total_paid: u64,
        timestamp: u64
    }

    public struct CampaignCompleted has copy, drop {
        campaign_id: ID,
        total_raised: u64,
        shares_sold: u64,
        timestamp: u64
    }

    public struct CampaignManuallyClosed has copy, drop {
        campaign_id: ID,
        total_raised: u64,
        shares_sold: u64,
        remaining_shares: u64,
        timestamp: u64
    }

    public struct CampaignFinalized has copy, drop {
        campaign_id: ID,
        timestamp: u64
    }

    public struct FundsWithdrawn has copy, drop {
        campaign_id: ID,
        amount: u64,
        recipient: address,
        timestamp: u64
    }

    // ==================== Initialization ====================

    /// Module initializer - creates AdminCap, Registry, and NFT Display
    fun init(otw: CAMPAIGN, ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };

        // Create global registry
        let registry = CampaignRegistry {
            id: object::new(ctx),
            active_campaign_id: option::none(),
            campaign_count: 0
        };

        // Create Publisher for Display
        let publisher = package::claim(otw, ctx);

        // Setup Display for ResortShareNFT
        let mut display = display::new<ResortShareNFT>(&publisher, ctx);
        
        display::add(&mut display, string::utf8(b"name"), string::utf8(b"{campaign_name} - Share #{issue_number}"));
        display::add(&mut display, string::utf8(b"description"), string::utf8(b"Fractional ownership share of {campaign_name} resort development"));
        // blob_id now supports both Walrus blob IDs and full URLs (Pinata, IPFS, etc.)
        display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"{blob_id}"));
        display::add(&mut display, string::utf8(b"project_url"), string::utf8(b"https://sinag.app"));
        display::add(&mut display, string::utf8(b"creator"), string::utf8(b"Sinag - RWA Resort Platform"));
        
        display::update_version(&mut display);

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(display, ctx.sender());
        transfer::transfer(admin_cap, ctx.sender());
        transfer::share_object(registry);
    }

    // ==================== Admin Functions ====================

    /// Create a new campaign using Walrus storage (only if no active campaign exists)
    public entry fun create_campaign(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        name: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        price_per_share: u64,
        total_supply: u64,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Ensure no active campaign exists
        assert!(option::is_none(&registry.active_campaign_id), EActiveCampaignExists);

        registry.campaign_count = registry.campaign_count + 1;

        let campaign = Campaign {
            id: object::new(ctx),
            campaign_number: registry.campaign_count,
            name: string::utf8(name),
            description: string::utf8(description),
            walrus_blob_id: string::utf8(walrus_blob_id),
            price_per_share,
            total_supply,
            shares_sold: 0,
            status: STATUS_ACTIVE,
            balance: balance::zero(),
            is_finalized: false,
            created_at: sui::clock::timestamp_ms(clock),
            closed_at: option::none()
        };

        let campaign_id = object::id(&campaign);
        registry.active_campaign_id = option::some(campaign_id);

        event::emit(CampaignCreated {
            campaign_id,
            campaign_number: registry.campaign_count,
            name: campaign.name,
            price_per_share,
            total_supply,
            created_at: campaign.created_at
        });

        transfer::share_object(campaign);
    }

    /// Create a new campaign using Pinata/IPFS or direct URL (only if no active campaign exists)
    /// Use this for easier image management with Pinata, IPFS, or any image hosting
    public entry fun create_campaign_with_url(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        price_per_share: u64,
        total_supply: u64,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Ensure no active campaign exists
        assert!(option::is_none(&registry.active_campaign_id), EActiveCampaignExists);

        registry.campaign_count = registry.campaign_count + 1;

        // Store the full URL directly as blob_id
        // This allows using Pinata, IPFS gateways, or any image URL
        let campaign = Campaign {
            id: object::new(ctx),
            campaign_number: registry.campaign_count,
            name: string::utf8(name),
            description: string::utf8(description),
            walrus_blob_id: string::utf8(image_url), // Stores full URL
            price_per_share,
            total_supply,
            shares_sold: 0,
            status: STATUS_ACTIVE,
            balance: balance::zero(),
            is_finalized: false,
            created_at: sui::clock::timestamp_ms(clock),
            closed_at: option::none()
        };

        let campaign_id = object::id(&campaign);
        registry.active_campaign_id = option::some(campaign_id);

        event::emit(CampaignCreated {
            campaign_id,
            campaign_number: registry.campaign_count,
            name: campaign.name,
            price_per_share,
            total_supply,
            created_at: campaign.created_at
        });

        transfer::share_object(campaign);
    }

    /// Manually close an active campaign before it sells out
    public entry fun close_campaign_manually(
        _admin: &AdminCap,
        campaign: &mut Campaign,
        clock: &sui::clock::Clock
    ) {
        assert!(campaign.status == STATUS_ACTIVE, ECampaignNotActive);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let remaining_shares = campaign.total_supply - campaign.shares_sold;
        
        campaign.status = STATUS_MANUALLY_CLOSED;
        campaign.closed_at = option::some(timestamp);

        event::emit(CampaignManuallyClosed {
            campaign_id: object::id(campaign),
            total_raised: balance::value(&campaign.balance),
            shares_sold: campaign.shares_sold,
            remaining_shares,
            timestamp
        });
    }

    /// Finalize a campaign to allow creation of next campaign
    /// Can only finalize Completed or ManuallyClosed campaigns
    public entry fun finalize_campaign(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        campaign: &mut Campaign,
        clock: &sui::clock::Clock
    ) {
        assert!(campaign.status != STATUS_ACTIVE, ECampaignStillActive);
        assert!(!campaign.is_finalized, ECampaignAlreadyFinalized);

        campaign.is_finalized = true;
        
        // Remove from active registry
        if (option::is_some(&registry.active_campaign_id)) {
            let active_id = *option::borrow(&registry.active_campaign_id);
            if (active_id == object::id(campaign)) {
                registry.active_campaign_id = option::none();
            };
        };

        event::emit(CampaignFinalized {
            campaign_id: object::id(campaign),
            timestamp: sui::clock::timestamp_ms(clock)
        });
    }

    /// Withdraw funds from a non-active campaign
    /// Funds are locked until campaign is Completed or ManuallyClosed
    public entry fun withdraw_funds(
        _admin: &AdminCap,
        campaign: &mut Campaign,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Campaign must not be active (funds locked during fundraising)
        assert!(campaign.status != STATUS_ACTIVE, ECampaignStillActive);
        
        let amount = balance::value(&campaign.balance);
        assert!(amount > 0, ENoFundsToWithdraw);

        let withdrawn = coin::take(&mut campaign.balance, amount, ctx);
        let recipient = ctx.sender();

        event::emit(FundsWithdrawn {
            campaign_id: object::id(campaign),
            amount,
            recipient,
            timestamp: sui::clock::timestamp_ms(clock)
        });

        transfer::public_transfer(withdrawn, recipient);
    }

    // ==================== User Functions ====================

    /// Mint shares (purchase NFTs) - supports multiple shares in single transaction
    public entry fun mint_shares(
        campaign: &mut Campaign,
        quantity: u64,
        payment: Coin<SUI>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validation checks
        assert!(campaign.status == STATUS_ACTIVE, ECampaignNotActive);
        assert!(quantity > 0, EInvalidShareAmount);
        assert!(campaign.shares_sold + quantity <= campaign.total_supply, EInsufficientShares);

        let expected_payment = campaign.price_per_share * quantity;
        let actual_payment = coin::value(&payment);
        assert!(actual_payment == expected_payment, EIncorrectPayment);

        // Add payment to campaign balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut campaign.balance, payment_balance);

        let buyer = ctx.sender();
        let campaign_id = object::id(campaign);
        let timestamp = sui::clock::timestamp_ms(clock);
        let mut issue_numbers = vector::empty<u64>();

        // Mint NFTs (one per share)
        let mut i = 0;
        while (i < quantity) {
            campaign.shares_sold = campaign.shares_sold + 1;
            let issue_number = campaign.shares_sold;

            vector::push_back(&mut issue_numbers, issue_number);

            let nft = ResortShareNFT {
                id: object::new(ctx),
                campaign_id,
                campaign_name: campaign.name,
                issue_number,
                blob_id: campaign.walrus_blob_id,
                minted_at: timestamp
            };

            transfer::public_transfer(nft, buyer);
            i = i + 1;
        };

        // Check if campaign is now sold out
        if (campaign.shares_sold == campaign.total_supply) {
            campaign.status = STATUS_COMPLETED;
            campaign.closed_at = option::some(timestamp);

            event::emit(CampaignCompleted {
                campaign_id,
                total_raised: balance::value(&campaign.balance),
                shares_sold: campaign.shares_sold,
                timestamp
            });
        };

        event::emit(SharesMinted {
            campaign_id,
            buyer,
            quantity,
            issue_numbers,
            total_paid: expected_payment,
            timestamp
        });
    }

    // ==================== View Functions ====================

    public fun get_campaign_name(campaign: &Campaign): String {
        campaign.name
    }

    public fun get_campaign_description(campaign: &Campaign): String {
        campaign.description
    }

    public fun get_campaign_blob_id(campaign: &Campaign): String {
        campaign.walrus_blob_id
    }

    public fun get_price_per_share(campaign: &Campaign): u64 {
        campaign.price_per_share
    }

    public fun get_total_supply(campaign: &Campaign): u64 {
        campaign.total_supply
    }

    public fun get_shares_sold(campaign: &Campaign): u64 {
        campaign.shares_sold
    }

    public fun get_shares_remaining(campaign: &Campaign): u64 {
        campaign.total_supply - campaign.shares_sold
    }

    public fun get_campaign_status(campaign: &Campaign): u8 {
        campaign.status
    }

    public fun is_campaign_active(campaign: &Campaign): bool {
        campaign.status == STATUS_ACTIVE
    }

    public fun get_total_raised(campaign: &Campaign): u64 {
        balance::value(&campaign.balance)
    }

    public fun get_campaign_number(campaign: &Campaign): u64 {
        campaign.campaign_number
    }

    public fun is_finalized(campaign: &Campaign): bool {
        campaign.is_finalized
    }

    // NFT view functions
    public fun get_nft_campaign_id(nft: &ResortShareNFT): ID {
        nft.campaign_id
    }

    public fun get_nft_campaign_name(nft: &ResortShareNFT): String {
        nft.campaign_name
    }

    public fun get_nft_issue_number(nft: &ResortShareNFT): u64 {
        nft.issue_number
    }

    public fun get_nft_blob_id(nft: &ResortShareNFT): String {
        nft.blob_id
    }

    // ==================== Admin Capability Management ====================

    /// Transfer admin capability to another address
    public entry fun transfer_admin_cap(
        admin_cap: AdminCap,
        recipient: address
    ) {
        transfer::transfer(admin_cap, recipient);
    }

    // ==================== Test Helper (Testnet Only) ====================
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        let otw = CAMPAIGN {};
        init(otw, ctx);
    }
}