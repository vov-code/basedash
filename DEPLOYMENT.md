# 🚀 BASE Dash — Contract Deployment Guide

## Prerequisites

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

3. **Configure `.env.local`**
   ```env
   # Private key for deployment (NEVER commit this!)
   PRIVATE_KEY=your_private_key_here

   # Basescan API key for contract verification
   BASESCAN_API_KEY=your_basescan_api_key

   # For testnet (default)
   NEXT_PUBLIC_USE_TESTNET=true
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

   # For mainnet (after deployment)
   # NEXT_PUBLIC_USE_TESTNET=false
   # NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_address
   ```

## 🔧 Compilation

Compile the Solidity contracts:

```bash
npm run compile
```

This will:
- Compile `contracts/GameLeaderboard.sol`
- Generate artifacts in `artifacts/` directory
- Copy ABI to `app/contracts/GameLeaderboardABI.json`

## 📤 Deployment to Base Sepolia (Testnet)

### Option 1: Quick Deploy
```bash
npm run deploy:base-sepolia
```

### Option 2: Full Deploy (Compile + Deploy)
```bash
npm run full-deploy:testnet
```

### What happens during deployment:
1. Contract is compiled
2. Contract is deployed to Base Sepolia
3. Contract address is saved to `app/contracts/contract-info.json`
4. ABI is copied to `app/contracts/GameLeaderboardABI.json`
5. `.env.local` is updated with the new contract address

### After deployment:
1. **Restart the dev server:**
   ```bash
   npm run dev
   ```

2. **Verify on Basescan:**
   Visit: `https://sepolia.basescan.org/address/<contract_address>`

## 🌐 Deployment to Base Mainnet

⚠️ **WARNING:** Mainnet deployment costs real ETH!

### Option 1: Quick Deploy
```bash
npm run deploy:base
```

### Option 2: Full Deploy (Compile + Deploy)
```bash
npm run full-deploy:mainnet
```

### Update environment for mainnet:
After deployment, update `.env.local`:
```env
NEXT_PUBLIC_USE_TESTNET=false
NEXT_PUBLIC_CONTRACT_ADDRESS=your_mainnet_contract_address
```

## 🧪 Testing

Run Hardhat tests:
```bash
npm run test
```

## ✅ Verification

Verify the contract on Basescan:
```bash
npm run verify
```

## 📋 Contract Features

### GameLeaderboard Contract

- **submitScore**: Submit player scores with signature verification
- **dailyCheckIn**: Daily check-in system with streak tracking
- **getLeaderboard**: Get top players
- **getSortedLeaderboard**: Get pre-sorted leaderboard
- **getPlayerRank**: Get player's rank and score
- **getCheckInStatus**: Get check-in status for a player

### Gas Optimizations

- Indexed events for efficient filtering
- Off-chain sorting (frontend handles sorting)
- Packed structs for storage efficiency
- Minimal storage operations

## 🔐 Security Notes

1. **Never commit `.env.local`** - It contains your private key
2. **Use separate wallets** - Use different wallets for testnet and mainnet
3. **Verify contract address** - Always verify the deployed address matches expected
4. **Score signer** - The `scoreSigner` address signs valid scores (backend API)

## 🛠 Troubleshooting

### "PRIVATE_KEY not found"
- Make sure `.env.local` exists and contains `PRIVATE_KEY`

### "Insufficient funds"
- Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

### "Contract not found in artifacts"
- Run `npm run compile` first

### Deployment fails silently
- Check Hardhat output for specific error messages
- Verify network connectivity to Base RPC

## 📞 Support

For issues or questions, check:
- [Base Documentation](https://docs.base.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
