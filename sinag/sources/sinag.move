/// Sinag - Real World Asset Resort Financing Platform
/// 
/// Multi-campaign system with dual-coin support (SUI + USDC)
/// Fractionalized resort ownership via NFT shares
module sinag::campaign {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::display;
    use sui::package;
    use sui::vec_set::{Self, VecSet};
    use std::string::{Self, String};

    // ==================== Error Codes ====================
    
    const ECampaignNotActive: u64 = 2;
    const ECampaignStillActive: u64 = 3;
    const EInsufficientShares: u64 = 4;
    const EIncorrectPayment: u64 = 5;
    const ENoFundsToWithdraw: u64 = 6;
    const ECampaignNotFinalized: u64 = 8;
    const EInvalidShareAmount: u64 = 9;
    const ECampaignAlreadyFinalized: u64 = 10;
    const EInvalidMaturityDays: u64 = 11;
    const EInvalidAPY: u64 = 12;
    const EInvalidImageCount: u64 = 13;

    
    // New error codes for yield system
    const ENoActiveRound: u64 = 20;
    const EAlreadyClaimed: u64 = 21;
    const EInvalidYieldAmount: u64 = 22;
    const EIncorrectYieldDeposit: u64 = 23;
    const ERoundNotActive: u64 = 24;
    const EWrongCampaign: u64 = 25;
    const ERoundNotFound: u64 = 26;

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

    /// Global registry tracking all campaigns
    public struct CampaignRegistry has key {
        id: UID,
        campaign_count: u64,
        total_campaigns_created: u64
    }

    /// Represents a single yield distribution round
    public struct YieldRound has store {
        round_number: u64,
        yield_per_share: u64,
        total_deposited: u64,
        total_claimed: u64,
        claimed_shares: u64,
        is_active: bool,
        opened_at: u64,
        closed_at: Option<u64>
    }

    /// Represents a single resort development fundraising campaign
    /// Generic CoinType allows accepting different payment tokens (SUI, USDC, etc.)
    public struct Campaign<phantom CoinType> has key, store {
        id: UID,
        campaign_number: u64,
        
        // Basic Info
        name: String,
        description: String,
        location: String,
        
        // Financial Details
        target_apy: u64,              // Basis points (e.g., 1850 = 18.5%)
        maturity_days: u64,           // Duration in days
        maturity_date: u64,           // Calculated timestamp
        structure: String,            // "Asset-Backed", "Guaranteed Yield", etc.
        
        // Share Details
        price_per_share: u64,         // Price in smallest unit (MIST for SUI, micro-USDC)
        total_supply: u64,
        shares_sold: u64,
        
        // Media
        resort_images: vector<String>, // Multiple images for carousel
        nft_image: String,             // Single image for NFT display
        due_diligence_url: Option<String>, // Optional document link
        
        // Financial Balance
        balance: Balance<CoinType>,
        
        // Status
        status: u8,
        is_finalized: bool,
        
        // Timestamps
        created_at: u64,
        closed_at: Option<u64>,
        
        // FEATURE 2: Coin Type
        coin_type_name: String,
        
        // FEATURE 3: Investor Tracking
        unique_investors: u64,
        investor_addresses: VecSet<address>,
        
        // FEATURE 1: Yield System
        yield_rounds: vector<YieldRound>,
        current_round: u64,
        yield_balance: Balance<CoinType>,
        total_yield_distributed: u64
    }

    /// NFT representing fractional ownership of a resort development
    public struct ResortShareNFT has key, store {
        id: UID,
        campaign_id: ID,
        campaign_name: String,
        location: String,
        issue_number: u64,
        nft_image: String,
        target_apy: u64,
        maturity_date: u64,
        structure: String,
        minted_at: u64,
        
        // FEATURE 1: Yield Tracking
        last_claimed_round: u64
    }

    // ==================== Events ====================

    public struct CampaignCreated has copy, drop {
        campaign_id: ID,
        campaign_number: u64,
        name: String,
        location: String,
        price_per_share: u64,
        total_supply: u64,
        target_apy: u64,
        maturity_days: u64,
        coin_type: String,
        created_at: u64
    }

    public struct SharesMinted has copy, drop {
        campaign_id: ID,
        buyer: address,
        quantity: u64,
        issue_numbers: vector<u64>,
        total_paid: u64,
        is_new_investor: bool,
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

    public struct YieldRoundOpened has copy, drop {
        campaign_id: ID,
        round_number: u64,
        yield_per_share: u64,
        total_deposited: u64,
        timestamp: u64
    }

    public struct YieldRoundClosed has copy, drop {
        campaign_id: ID,
        round_number: u64,
        total_claimed: u64,
        total_deposited: u64,
        unclaimed_shares: u64,
        timestamp: u64
    }

    public struct YieldClaimed has copy, drop {
        campaign_id: ID,
        nft_id: ID,
        round_number: u64,
        amount: u64,
        claimer: address,
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
            campaign_count: 0,
            total_campaigns_created: 0
        };

        // Create Publisher for Display
        let publisher = package::claim(otw, ctx);

        // Setup Display for ResortShareNFT
        let mut display = display::new<ResortShareNFT>(&publisher, ctx);
        
        display::add(&mut display, string::utf8(b"name"), string::utf8(b"{campaign_name} - Share #{issue_number}"));
        display::add(&mut display, string::utf8(b"description"), string::utf8(b"Fractional ownership of {campaign_name} resort in {location}. Target APY: {target_apy}bps. Structure: {structure}"));
        display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"{nft_image}"));
        display::add(&mut display, string::utf8(b"project_url"), string::utf8(b"https://sinag.app"));
        display::add(&mut display, string::utf8(b"creator"), string::utf8(b"Sinag - RWA Resort Platform"));
        
        display::update_version(&mut display);

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(display, ctx.sender());
        transfer::transfer(admin_cap, ctx.sender());
        transfer::share_object(registry);
    }

    // ==================== Admin Functions ====================

    /// Create a new campaign accepting SUI payments
    entry fun create_campaign_sui(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        name: vector<u8>,
        description: vector<u8>,
        location: vector<u8>,
        target_apy: u64,
        maturity_days: u64,
        structure: vector<u8>,
        price_per_share: u64,
        total_supply: u64,
        resort_images: vector<vector<u8>>,
        nft_image: vector<u8>,
        due_diligence_url: Option<vector<u8>>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        create_campaign_internal<SUI>(
            registry,
            name,
            description,
            location,
            target_apy,
            maturity_days,
            structure,
            price_per_share,
            total_supply,
            resort_images,
            nft_image,
            due_diligence_url,
            string::utf8(b"SUI"),
            clock,
            ctx
        );
    }

    /// Create a new campaign accepting USDC payments
    entry fun create_campaign_usdc<USDC>(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        name: vector<u8>,
        description: vector<u8>,
        location: vector<u8>,
        target_apy: u64,
        maturity_days: u64,
        structure: vector<u8>,
        price_per_share: u64,
        total_supply: u64,
        resort_images: vector<vector<u8>>,
        nft_image: vector<u8>,
        mut due_diligence_url: Option<vector<u8>>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        create_campaign_internal<USDC>(
            registry,
            name,
            description,
            location,
            target_apy,
            maturity_days,
            structure,
            price_per_share,
            total_supply,
            resort_images,
            nft_image,
            due_diligence_url,
            string::utf8(b"USDC"),
            clock,
            ctx
        );
    }

    /// Internal campaign creation logic
    fun create_campaign_internal<CoinType>(
        registry: &mut CampaignRegistry,
        name: vector<u8>,
        description: vector<u8>,
        location: vector<u8>,
        target_apy: u64,
        maturity_days: u64,
        structure: vector<u8>,
        price_per_share: u64,
        total_supply: u64,
        resort_images: vector<vector<u8>>,
        nft_image: vector<u8>,
        mut due_diligence_url: Option<vector<u8>>,
        coin_type_name: String,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validation
        assert!(target_apy > 0 && target_apy <= 10000, EInvalidAPY);
        assert!(maturity_days > 0, EInvalidMaturityDays);
        assert!(vector::length(&resort_images) > 0, EInvalidImageCount);

        registry.total_campaigns_created = registry.total_campaigns_created + 1;
        registry.campaign_count = registry.campaign_count + 1;

        let created_at = sui::clock::timestamp_ms(clock);
        let maturity_date = created_at + (maturity_days * 86400000);

        // Convert image vectors to strings
        let mut image_strings = vector::empty<String>();
        let mut i = 0;
        while (i < vector::length(&resort_images)) {
            vector::push_back(&mut image_strings, string::utf8(*vector::borrow(&resort_images, i)));
            i = i + 1;
        };

        // Convert optional due diligence URL
        let dd_url = if (option::is_some(&due_diligence_url)) {
            option::some(string::utf8(option::extract(&mut due_diligence_url)))
        } else {
            option::none()
        };

        let campaign = Campaign<CoinType> {
            id: object::new(ctx),
            campaign_number: registry.total_campaigns_created,
            name: string::utf8(name),
            description: string::utf8(description),
            location: string::utf8(location),
            target_apy,
            maturity_days,
            maturity_date,
            structure: string::utf8(structure),
            price_per_share,
            total_supply,
            shares_sold: 0,
            resort_images: image_strings,
            nft_image: string::utf8(nft_image),
            due_diligence_url: dd_url,
            balance: balance::zero(),
            status: STATUS_ACTIVE,
            is_finalized: false,
            created_at,
            closed_at: option::none(),
            coin_type_name,
            unique_investors: 0,
            investor_addresses: vec_set::empty(),
            yield_rounds: vector::empty(),
            current_round: 0,
            yield_balance: balance::zero(),
            total_yield_distributed: 0
        };

        let campaign_id = object::id(&campaign);

        event::emit(CampaignCreated {
            campaign_id,
            campaign_number: registry.total_campaigns_created,
            name: campaign.name,
            location: campaign.location,
            price_per_share,
            total_supply,
            target_apy,
            maturity_days,
            coin_type: coin_type_name,
            created_at
        });

        transfer::share_object(campaign);
    }

    /// Manually close an active campaign before it sells out
    entry fun close_campaign_manually<CoinType>(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        campaign: &mut Campaign<CoinType>,
        clock: &sui::clock::Clock
    ) {
        assert!(campaign.status == STATUS_ACTIVE, ECampaignNotActive);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let remaining_shares = campaign.total_supply - campaign.shares_sold;
        
        campaign.status = STATUS_MANUALLY_CLOSED;
        campaign.closed_at = option::some(timestamp);
        registry.campaign_count = registry.campaign_count - 1;

        event::emit(CampaignManuallyClosed {
            campaign_id: object::id(campaign),
            total_raised: balance::value(&campaign.balance),
            shares_sold: campaign.shares_sold,
            remaining_shares,
            timestamp
        });
    }

    /// Finalize a campaign
    entry fun finalize_campaign<CoinType>(
        _admin: &AdminCap,
        registry: &mut CampaignRegistry,
        campaign: &mut Campaign<CoinType>,
        clock: &sui::clock::Clock
    ) {
        assert!(campaign.status != STATUS_ACTIVE, ECampaignStillActive);
        assert!(!campaign.is_finalized, ECampaignAlreadyFinalized);

        campaign.is_finalized = true;
        
        if (campaign.status == STATUS_ACTIVE) {
            registry.campaign_count = registry.campaign_count - 1;
        };

        event::emit(CampaignFinalized {
            campaign_id: object::id(campaign),
            timestamp: sui::clock::timestamp_ms(clock)
        });
    }

    /// Withdraw funds from a finalized campaign
    entry fun withdraw_funds<CoinType>(
        _admin: &AdminCap,
        campaign: &mut Campaign<CoinType>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(campaign.status != STATUS_ACTIVE, ECampaignStillActive);
        assert!(campaign.is_finalized, ECampaignNotFinalized);
        
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

    // ==================== Yield Distribution Functions ====================

    /// Admin opens a new yield round and deposits yield funds
    entry fun open_yield_round<CoinType>(
        _admin: &AdminCap,
        campaign: &mut Campaign<CoinType>,
        yield_per_share: u64,
        yield_deposit: Coin<CoinType>,
        clock: &sui::clock::Clock,
        _ctx: &mut TxContext
    ) {
        // Validate campaign is not active (must be closed/completed)
        assert!(campaign.status != STATUS_ACTIVE, ECampaignStillActive);
        assert!(yield_per_share > 0, EInvalidYieldAmount);
        
        // Calculate expected deposit: yield_per_share * total_supply
        let expected_deposit = yield_per_share * campaign.total_supply;
        let actual_deposit = coin::value(&yield_deposit);
        assert!(actual_deposit == expected_deposit, EIncorrectYieldDeposit);
        
        // Increment round number
        campaign.current_round = campaign.current_round + 1;
        let round_number = campaign.current_round;
        
        let timestamp = sui::clock::timestamp_ms(clock);
        
        // Create new yield round
        let new_round = YieldRound {
            round_number,
            yield_per_share,
            total_deposited: actual_deposit,
            total_claimed: 0,
            claimed_shares: 0,
            is_active: true,
            opened_at: timestamp,
            closed_at: option::none()
        };
        
        // Add deposit to yield balance
        let deposit_balance = coin::into_balance(yield_deposit);
        balance::join(&mut campaign.yield_balance, deposit_balance);
        
        // Add round to history
        vector::push_back(&mut campaign.yield_rounds, new_round);
        
        event::emit(YieldRoundOpened {
            campaign_id: object::id(campaign),
            round_number,
            yield_per_share,
            total_deposited: actual_deposit,
            timestamp
        });
    }

    /// Admin closes active yield round (stops new claims)
    entry fun close_yield_round<CoinType>(
        _admin: &AdminCap,
        campaign: &mut Campaign<CoinType>,
        round_number: u64,
        clock: &sui::clock::Clock
    ) {
        assert!(round_number > 0 && round_number <= vector::length(&campaign.yield_rounds), ERoundNotFound);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let campaign_id = object::id(campaign);
        
        let round = vector::borrow_mut(&mut campaign.yield_rounds, round_number - 1);
        assert!(round.is_active, ERoundNotActive);
        
        round.is_active = false;
        round.closed_at = option::some(timestamp);
        
        let total_claimed = round.total_claimed;
        let total_deposited = round.total_deposited;
        let unclaimed_shares = campaign.total_supply - round.claimed_shares;
        
        event::emit(YieldRoundClosed {
            campaign_id,
            round_number,
            total_claimed,
            total_deposited,
            unclaimed_shares,
            timestamp
        });
    }

    /// User claims yield for one NFT
    entry fun claim_yield<CoinType>(
        campaign: &mut Campaign<CoinType>,
        nft: &mut ResortShareNFT,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validate NFT belongs to this campaign
        assert!(nft.campaign_id == object::id(campaign), EWrongCampaign);
        
        // Validate current round exists
        assert!(campaign.current_round > 0, ENoActiveRound);
        
        // Get current round
        let round = vector::borrow_mut(&mut campaign.yield_rounds, campaign.current_round - 1);
        
        // Validate round is active
        assert!(round.is_active, ERoundNotActive);
        
        // Validate NFT hasn't claimed this round
        assert!(nft.last_claimed_round < campaign.current_round, EAlreadyClaimed);
        
        // Calculate yield
        let yield_amount = round.yield_per_share;
        
        // Update NFT
        nft.last_claimed_round = campaign.current_round;
        
        // Update round stats
        round.total_claimed = round.total_claimed + yield_amount;
        round.claimed_shares = round.claimed_shares + 1;
        
        // Update campaign stats
        campaign.total_yield_distributed = campaign.total_yield_distributed + yield_amount;
        
        // Transfer yield to user
        let yield_coin = coin::take(&mut campaign.yield_balance, yield_amount, ctx);
        let claimer = ctx.sender();
        
        event::emit(YieldClaimed {
            campaign_id: object::id(campaign),
            nft_id: object::id(nft),
            round_number: campaign.current_round,
            amount: yield_amount,
            claimer,
            timestamp: sui::clock::timestamp_ms(clock)
        });
        
        transfer::public_transfer(yield_coin, claimer);
    }

    /// User claims yield for two NFTs in one transaction (gas efficient)
    entry fun claim_yield_batch_2<CoinType>(
        campaign: &mut Campaign<CoinType>,
        nft1: &mut ResortShareNFT,
        nft2: &mut ResortShareNFT,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validate current round exists
        assert!(campaign.current_round > 0, ENoActiveRound);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let claimer = ctx.sender();
        let campaign_id = object::id(campaign);
        let current_round = campaign.current_round;
        
        // Get current round
        let round = vector::borrow_mut(&mut campaign.yield_rounds, current_round - 1);
        
        // Validate round is active
        assert!(round.is_active, ERoundNotActive);
        
        let mut total_yield = 0u64;
        let mut nfts_claimed = 0u64;
        let yield_per_share = round.yield_per_share;
        
        // Process NFT 1
        assert!(nft1.campaign_id == campaign_id, EWrongCampaign);
        if (nft1.last_claimed_round < current_round) {
            nft1.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft1),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Process NFT 2
        assert!(nft2.campaign_id == campaign_id, EWrongCampaign);
        if (nft2.last_claimed_round < current_round) {
            nft2.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft2),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Update round stats
        round.total_claimed = round.total_claimed + total_yield;
        round.claimed_shares = round.claimed_shares + nfts_claimed;
        
        // Update campaign stats
        campaign.total_yield_distributed = campaign.total_yield_distributed + total_yield;
        
        // Transfer total yield in one transaction
        if (total_yield > 0) {
            let yield_coin = coin::take(&mut campaign.yield_balance, total_yield, ctx);
            transfer::public_transfer(yield_coin, claimer);
        };
    }

    /// User claims yield for three NFTs in one transaction (gas efficient)
    entry fun claim_yield_batch_3<CoinType>(
        campaign: &mut Campaign<CoinType>,
        nft1: &mut ResortShareNFT,
        nft2: &mut ResortShareNFT,
        nft3: &mut ResortShareNFT,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validate current round exists
        assert!(campaign.current_round > 0, ENoActiveRound);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let claimer = ctx.sender();
        let campaign_id = object::id(campaign);
        let current_round = campaign.current_round;
        
        // Get current round
        let round = vector::borrow_mut(&mut campaign.yield_rounds, current_round - 1);
        
        // Validate round is active
        assert!(round.is_active, ERoundNotActive);
        
        let mut total_yield = 0u64;
        let mut nfts_claimed = 0u64;
        let yield_per_share = round.yield_per_share;
        
        // Process NFT 1
        assert!(nft1.campaign_id == campaign_id, EWrongCampaign);
        if (nft1.last_claimed_round < current_round) {
            nft1.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft1),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Process NFT 2
        assert!(nft2.campaign_id == campaign_id, EWrongCampaign);
        if (nft2.last_claimed_round < current_round) {
            nft2.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft2),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Process NFT 3
        assert!(nft3.campaign_id == campaign_id, EWrongCampaign);
        if (nft3.last_claimed_round < current_round) {
            nft3.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft3),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Update round stats
        round.total_claimed = round.total_claimed + total_yield;
        round.claimed_shares = round.claimed_shares + nfts_claimed;
        
        // Update campaign stats
        campaign.total_yield_distributed = campaign.total_yield_distributed + total_yield;
        
        // Transfer total yield in one transaction
        if (total_yield > 0) {
            let yield_coin = coin::take(&mut campaign.yield_balance, total_yield, ctx);
            transfer::public_transfer(yield_coin, claimer);
        };
    }

    /// User claims yield for five NFTs in one transaction (gas efficient)
    entry fun claim_yield_batch_5<CoinType>(
        campaign: &mut Campaign<CoinType>,
        nft1: &mut ResortShareNFT,
        nft2: &mut ResortShareNFT,
        nft3: &mut ResortShareNFT,
        nft4: &mut ResortShareNFT,
        nft5: &mut ResortShareNFT,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validate current round exists
        assert!(campaign.current_round > 0, ENoActiveRound);
        
        let timestamp = sui::clock::timestamp_ms(clock);
        let claimer = ctx.sender();
        let campaign_id = object::id(campaign);
        let current_round = campaign.current_round;
        
        // Get current round
        let round = vector::borrow_mut(&mut campaign.yield_rounds, current_round - 1);
        
        // Validate round is active
        assert!(round.is_active, ERoundNotActive);
        
        let mut total_yield = 0u64;
        let mut nfts_claimed = 0u64;
        let yield_per_share = round.yield_per_share;
        
        // Process all 5 NFTs
        assert!(nft1.campaign_id == campaign_id, EWrongCampaign);
        if (nft1.last_claimed_round < current_round) {
            nft1.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft1),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        assert!(nft2.campaign_id == campaign_id, EWrongCampaign);
        if (nft2.last_claimed_round < current_round) {
            nft2.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft2),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        assert!(nft3.campaign_id == campaign_id, EWrongCampaign);
        if (nft3.last_claimed_round < current_round) {
            nft3.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft3),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        assert!(nft4.campaign_id == campaign_id, EWrongCampaign);
        if (nft4.last_claimed_round < current_round) {
            nft4.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft4),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        assert!(nft5.campaign_id == campaign_id, EWrongCampaign);
        if (nft5.last_claimed_round < current_round) {
            nft5.last_claimed_round = current_round;
            total_yield = total_yield + yield_per_share;
            nfts_claimed = nfts_claimed + 1;
            event::emit(YieldClaimed {
                campaign_id,
                nft_id: object::id(nft5),
                round_number: current_round,
                amount: yield_per_share,
                claimer,
                timestamp
            });
        };
        
        // Update round stats
        round.total_claimed = round.total_claimed + total_yield;
        round.claimed_shares = round.claimed_shares + nfts_claimed;
        
        // Update campaign stats
        campaign.total_yield_distributed = campaign.total_yield_distributed + total_yield;
        
        // Transfer total yield in one transaction
        if (total_yield > 0) {
            let yield_coin = coin::take(&mut campaign.yield_balance, total_yield, ctx);
            transfer::public_transfer(yield_coin, claimer);
        };
    }

    // ==================== User Functions ====================

    /// Mint shares by paying with the campaign's accepted coin type
    entry fun mint_shares<CoinType>(
        campaign: &mut Campaign<CoinType>,
        quantity: u64,
        payment: Coin<CoinType>,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        // Validation
        assert!(campaign.status == STATUS_ACTIVE, ECampaignNotActive);
        assert!(quantity > 0, EInvalidShareAmount);
        assert!(campaign.shares_sold + quantity <= campaign.total_supply, EInsufficientShares);

        let expected_payment = campaign.price_per_share * quantity;
        let actual_payment = coin::value(&payment);
        assert!(actual_payment == expected_payment, EIncorrectPayment);

        // FEATURE 3: Track unique investor
        let buyer = ctx.sender();
        let is_new_investor = !vec_set::contains(&campaign.investor_addresses, &buyer);
        
        if (is_new_investor) {
            vec_set::insert(&mut campaign.investor_addresses, buyer);
            campaign.unique_investors = campaign.unique_investors + 1;
        };

        // Add payment to campaign balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut campaign.balance, payment_balance);

        // Mint NFTs
        let (issue_numbers, timestamp) = mint_nfts_internal(
            campaign,
            quantity,
            clock,
            ctx
        );

        event::emit(SharesMinted {
            campaign_id: object::id(campaign),
            buyer,
            quantity,
            issue_numbers,
            total_paid: expected_payment,
            is_new_investor,
            timestamp
        });

        // Check if sold out
        check_campaign_completion(campaign, timestamp);
    }

    // ==================== Internal Helper Functions ====================

    /// Internal function to mint NFTs
    fun mint_nfts_internal<CoinType>(
        campaign: &mut Campaign<CoinType>,
        quantity: u64,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ): (vector<u64>, u64) {
        let buyer = ctx.sender();
        let campaign_id = object::id(campaign);
        let timestamp = sui::clock::timestamp_ms(clock);
        let mut issue_numbers = vector::empty<u64>();

        let mut i = 0;
        while (i < quantity) {
            campaign.shares_sold = campaign.shares_sold + 1;
            let issue_number = campaign.shares_sold;

            vector::push_back(&mut issue_numbers, issue_number);

            let nft = ResortShareNFT {
                id: object::new(ctx),
                campaign_id,
                campaign_name: campaign.name,
                location: campaign.location,
                issue_number,
                nft_image: campaign.nft_image,
                target_apy: campaign.target_apy,
                maturity_date: campaign.maturity_date,
                structure: campaign.structure,
                minted_at: timestamp,
                last_claimed_round: 0
            };

            transfer::public_transfer(nft, buyer);
            i = i + 1;
        };

        (issue_numbers, timestamp)
    }

    /// Check if campaign is completed (sold out)
    fun check_campaign_completion<CoinType>(campaign: &mut Campaign<CoinType>, timestamp: u64) {
        if (campaign.shares_sold == campaign.total_supply) {
            campaign.status = STATUS_COMPLETED;
            campaign.closed_at = option::some(timestamp);

            event::emit(CampaignCompleted {
                campaign_id: object::id(campaign),
                total_raised: balance::value(&campaign.balance),
                shares_sold: campaign.shares_sold,
                timestamp
            });
        }
    }

    // ==================== View Functions - Yield ====================

    /// Check how much yield one NFT can claim
    public fun get_claimable_yield<CoinType>(
        campaign: &Campaign<CoinType>,
        nft: &ResortShareNFT
    ): u64 {
        if (campaign.current_round == 0) {
            return 0
        };
        
        if (nft.last_claimed_round >= campaign.current_round) {
            return 0
        };
        
        let round = vector::borrow(&campaign.yield_rounds, campaign.current_round - 1);
        
        if (!round.is_active) {
            return 0
        };
        
        round.yield_per_share
    }

    /// Check total claimable yield for two NFTs
    public fun get_claimable_yield_2<CoinType>(
        campaign: &Campaign<CoinType>,
        nft1: &ResortShareNFT,
        nft2: &ResortShareNFT
    ): u64 {
        get_claimable_yield(campaign, nft1) + get_claimable_yield(campaign, nft2)
    }

    /// Check total claimable yield for three NFTs
    public fun get_claimable_yield_3<CoinType>(
        campaign: &Campaign<CoinType>,
        nft1: &ResortShareNFT,
        nft2: &ResortShareNFT,
        nft3: &ResortShareNFT
    ): u64 {
        get_claimable_yield(campaign, nft1) + 
        get_claimable_yield(campaign, nft2) + 
        get_claimable_yield(campaign, nft3)
    }

    /// Check total claimable yield for five NFTs
    public fun get_claimable_yield_5<CoinType>(
        campaign: &Campaign<CoinType>,
        nft1: &ResortShareNFT,
        nft2: &ResortShareNFT,
        nft3: &ResortShareNFT,
        nft4: &ResortShareNFT,
        nft5: &ResortShareNFT
    ): u64 {
        get_claimable_yield(campaign, nft1) + 
        get_claimable_yield(campaign, nft2) + 
        get_claimable_yield(campaign, nft3) + 
        get_claimable_yield(campaign, nft4) + 
        get_claimable_yield(campaign, nft5)
    }

    /// Get information about a specific yield round
    public fun get_yield_round_info<CoinType>(
        campaign: &Campaign<CoinType>,
        round_number: u64
    ): (u64, u64, u64, u64, bool, u64) {
        assert!(round_number > 0 && round_number <= vector::length(&campaign.yield_rounds), ERoundNotFound);
        
        let round = vector::borrow(&campaign.yield_rounds, round_number - 1);
        (
            round.yield_per_share,
            round.total_deposited,
            round.total_claimed,
            round.claimed_shares,
            round.is_active,
            round.opened_at
        )
    }

    /// Get current round number
    public fun get_current_round<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.current_round
    }

    /// Check if NFT claimed current round
    public fun has_claimed_current_round(
        nft: &ResortShareNFT,
        current_round: u64
    ): bool {
        nft.last_claimed_round >= current_round
    }

    /// Get total yield balance
    public fun get_yield_balance<CoinType>(campaign: &Campaign<CoinType>): u64 {
        balance::value(&campaign.yield_balance)
    }

    /// Get total yield distributed lifetime
    public fun get_total_yield_distributed<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.total_yield_distributed
    }

    // ==================== View Functions - Campaign ====================

    public fun get_campaign_number<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.campaign_number
    }

    public fun get_campaign_name<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.name
    }

    public fun get_campaign_description<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.description
    }

    public fun get_campaign_location<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.location
    }

    public fun get_target_apy<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.target_apy
    }

    public fun get_maturity_days<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.maturity_days
    }

    public fun get_maturity_date<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.maturity_date
    }

    public fun get_structure<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.structure
    }

    public fun get_price_per_share<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.price_per_share
    }

    public fun get_total_supply<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.total_supply
    }

    public fun get_shares_sold<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.shares_sold
    }

    public fun get_shares_remaining<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.total_supply - campaign.shares_sold
    }

    public fun get_resort_images<CoinType>(campaign: &Campaign<CoinType>): vector<String> {
        campaign.resort_images
    }

    public fun get_campaign_nft_image<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.nft_image
    }

    public fun get_due_diligence_url<CoinType>(campaign: &Campaign<CoinType>): Option<String> {
        campaign.due_diligence_url
    }

    public fun get_campaign_status<CoinType>(campaign: &Campaign<CoinType>): u8 {
        campaign.status
    }

    public fun is_campaign_active<CoinType>(campaign: &Campaign<CoinType>): bool {
        campaign.status == STATUS_ACTIVE
    }

    public fun get_total_raised<CoinType>(campaign: &Campaign<CoinType>): u64 {
        balance::value(&campaign.balance)
    }

    public fun is_finalized<CoinType>(campaign: &Campaign<CoinType>): bool {
        campaign.is_finalized
    }

    public fun get_created_at<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.created_at
    }

    public fun get_closed_at<CoinType>(campaign: &Campaign<CoinType>): Option<u64> {
        campaign.closed_at
    }

    /// FEATURE 2: Get coin type name
    public fun get_coin_type<CoinType>(campaign: &Campaign<CoinType>): String {
        campaign.coin_type_name
    }

    // ==================== View Functions - Investor Tracking ====================

    /// FEATURE 3: Get count of unique investors
    public fun get_unique_investor_count<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.unique_investors
    }

    /// FEATURE 3: Check if an address is an investor in this campaign
    public fun is_investor<CoinType>(campaign: &Campaign<CoinType>, addr: address): bool {
        vec_set::contains(&campaign.investor_addresses, &addr)
    }

    /// FEATURE 3: Get total number of investors (same as unique count)
    public fun get_investor_count<CoinType>(campaign: &Campaign<CoinType>): u64 {
        campaign.unique_investors
    }

    // ==================== View Functions - NFT ====================

    public fun get_nft_campaign_id(nft: &ResortShareNFT): ID {
        nft.campaign_id
    }

    public fun get_nft_campaign_name(nft: &ResortShareNFT): String {
        nft.campaign_name
    }

    public fun get_nft_location(nft: &ResortShareNFT): String {
        nft.location
    }

    public fun get_nft_issue_number(nft: &ResortShareNFT): u64 {
        nft.issue_number
    }

    public fun nft_image_url(nft: &ResortShareNFT): String {
        nft.nft_image
    }

    public fun get_nft_target_apy(nft: &ResortShareNFT): u64 {
        nft.target_apy
    }

    public fun get_nft_maturity_date(nft: &ResortShareNFT): u64 {
        nft.maturity_date
    }

    public fun get_nft_structure(nft: &ResortShareNFT): String {
        nft.structure
    }

    public fun get_nft_minted_at(nft: &ResortShareNFT): u64 {
        nft.minted_at
    }

    public fun get_nft_last_claimed_round(nft: &ResortShareNFT): u64 {
        nft.last_claimed_round
    }

    // ==================== View Functions - Registry ====================

    public fun get_active_campaign_count(registry: &CampaignRegistry): u64 {
        registry.campaign_count
    }

    public fun get_total_campaigns_created(registry: &CampaignRegistry): u64 {
        registry.total_campaigns_created
    }

    // ==================== Admin Capability Management ====================

    /// Transfer admin capability to another address
    entry fun transfer_admin_cap(
        admin_cap: AdminCap,
        recipient: address
    ) {
        transfer::transfer(admin_cap, recipient);
    }

    // ==================== Test Helper ====================
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        let otw = CAMPAIGN {};
        init(otw, ctx);
    }
}