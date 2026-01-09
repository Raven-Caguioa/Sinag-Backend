# Sinag Admin Dashboard

Admin interface for managing Sinag Protocol RWA (Real World Asset) resort financing campaigns on the SUI blockchain.

## Features

- ✅ **Create Campaigns** - Launch new resort funding campaigns with SUI or USDC
- ✅ **Close Campaigns** - Manually close active campaigns before they complete
- ✅ **Finalize Campaigns** - Mark campaigns as finalized to enable withdrawals
- ✅ **Withdraw Funds** - Withdraw collected funds from finalized campaigns
- ✅ **Dashboard** - View stats and manage all campaigns
- ✅ **Dark Mode** - Beautiful dark/light theme support
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## Prerequisites

- Node.js 18+ installed
- A SUI wallet (Sui Wallet, Suiet, or Ethos)
- Admin capability NFT from the Sinag Protocol contract

## Installation

### 1. Create the Next.js Project

```bash
npx create-next-app@latest sinag-admin --typescript --tailwind --app --no-src-dir
cd sinag-admin
```

### 2. Install Dependencies

```bash
npm install @mysten/sui.js @mysten/dapp-kit @tanstack/react-query lucide-react date-fns
npm install -D @types/node
```

### 3. Project Structure

Create the following directory structure:

```
sinag-admin/
├── app/
│   ├── create-campaign/
│   │   └── page.tsx
│   ├── close-campaign/
│   │   └── page.tsx
│   ├── finalize-campaign/
│   │   └── page.tsx
│   ├── withdraw-funds/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   └── AdminLayout.tsx
│   └── providers/
│       └── SuiProvider.tsx
├── lib/
│   ├── constants.ts
│   ├── types.ts
│   └── utils.ts
├── package.json
└── README.md
```

### 4. Copy Files

Copy each file I provided into the appropriate location in your project:

1. **lib/constants.ts** - Contract addresses and configuration
2. **lib/types.ts** - TypeScript type definitions
3. **lib/utils.ts** - Utility functions
4. **components/providers/SuiProvider.tsx** - SUI wallet provider
5. **components/layout/AdminLayout.tsx** - Main layout component
6. **app/layout.tsx** - Root layout
7. **app/globals.css** - Global styles
8. **app/page.tsx** - Dashboard page
9. **app/create-campaign/page.tsx** - Create campaign page
10. **app/close-campaign/page.tsx** - Close campaign page
11. **app/finalize-campaign/page.tsx** - Finalize campaign page
12. **app/withdraw-funds/page.tsx** - Withdraw funds page

### 5. Update Configuration

Edit `lib/constants.ts` and verify the contract addresses match your deployment:

```typescript
export const PACKAGE_ID = "0x6d9a0ac9f9741f5e578a4e874010760ab2da7d558b7c4115174c631ee694b48e";
export const ADMIN_CAP = "0x0668c62d4e50465b6937801640b252c021dea220b6d91315732b9fee6ba78213";
export const REGISTRY = "0x263b9e70a6433b3430330f8077aabf0022ba0cc27d7513378acca55b69e7b4ab";
// ... etc
```

### 6. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your admin dashboard.

## Usage

### Connecting Your Wallet

1. Click "Connect Wallet" in the top right
2. Select your SUI wallet (Sui Wallet, Suiet, or Ethos)
3. Approve the connection

**Important:** You must own the Admin Capability NFT to perform admin functions.

### Creating a Campaign

1. Navigate to "Create Campaign" from the sidebar
2. Choose payment token (SUI or USDC)
3. Fill in all required fields:
   - Campaign name and description
   - Location
   - Target APY (as percentage)
   - Maturity period (in days)
   - Structure type
   - Price per share
   - Total supply of shares
   - Resort images (at least 1)
   - NFT image
   - Due diligence document (optional)
4. Click "Create Campaign"
5. Approve the transaction in your wallet

### Closing a Campaign

1. Navigate to "Close Campaign"
2. Select an active campaign from the list
3. Click "Close Selected Campaign"
4. Confirm the transaction

**Note:** This action stops new investments but keeps existing shares valid.

### Finalizing a Campaign

1. Navigate to "Finalize Campaign"
2. Select a closed (but not yet finalized) campaign
3. Click "Finalize Selected Campaign"
4. Confirm the transaction

**Required:** A campaign must be finalized before funds can be withdrawn.

### Withdrawing Funds

1. Navigate to "Withdraw Funds"
2. Select a finalized campaign with available balance
3. Review the withdrawal summary
4. Click the withdraw button
5. Confirm the transaction

Funds will be sent to your connected wallet address.

## Configuration

### Network

By default, the app connects to SUI testnet. To change networks, edit `lib/constants.ts`:

```typescript
export const NETWORK = "mainnet"; // or "testnet"
```

### Coin Types

For USDC campaigns, ensure you have the correct USDC type for your network in `lib/constants.ts`:

```typescript
export const USDC_TYPE = "YOUR_USDC_PACKAGE_ID::usdc::USDC";
```

## Troubleshooting

### "No Admin Cap" Error

Make sure your connected wallet owns the Admin Capability NFT. Check:
- You're on the correct network (testnet/mainnet)
- The ADMIN_CAP address in constants.ts matches your deployment
- Your wallet actually owns the admin cap NFT

### Campaigns Not Loading

Verify:
- PACKAGE_ID and REGISTRY addresses are correct
- You're connected to the right network
- The contract is deployed and accessible

### Transaction Failures

Common causes:
- Insufficient gas (SUI) in wallet
- Campaign state doesn't allow the operation
- Contract addresses are incorrect
- Network congestion

Check the browser console for detailed error messages.

## Development

### Building for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **SUI SDK** (@mysten/sui.js) - Blockchain interaction
- **DApp Kit** (@mysten/dapp-kit) - Wallet connection
- **Lucide React** - Icons
- **React Query** - Data fetching

## License

MIT

## Support

For issues or questions:
- Check the SUI documentation: https://docs.sui.io
- Review the Move contract code
- Open an issue in the repository

---

Built with ❤️ for Sinag Protocol