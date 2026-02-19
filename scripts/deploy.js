const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🚀 Deploying GameLeaderboard to Base Sepolia...')

  // Проверяем приватный ключ
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env.local')
    console.error('Please add your private key to .env.local')
    process.exit(1)
  }

  console.log('✓ Private key found')
  console.log('✓ Deployer address:', new ethers.Wallet(privateKey).address)

  const GameLeaderboard = await ethers.getContractFactory('GameLeaderboard')
  const leaderboard = await GameLeaderboard.deploy()

  console.log('⏳ Waiting for deployment...')
  await leaderboard.waitForDeployment()

  const address = await leaderboard.getAddress()
  console.log('✅ GameLeaderboard deployed to:', address)

  // Сохраняем адрес для frontend
  const contractsDir = path.join(process.cwd(), 'app', 'contracts')

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true })
  }

  const contractInfo = {
    address: address,
    network: 'base-sepolia',
    deployedAt: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(contractsDir, 'contract-info.json'),
    JSON.stringify(contractInfo, null, 2)
  )

  console.log('📄 Contract info saved to app/contracts/contract-info.json')

  // Копируем ABI
  const artifactPath = path.join(
    process.cwd(),
    'artifacts',
    'contracts',
    'GameLeaderboard.sol',
    'GameLeaderboard.json'
  )

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    fs.writeFileSync(
      path.join(contractsDir, 'GameLeaderboardABI.json'),
      JSON.stringify(artifact.abi, null, 2)
    )
    console.log('📄 ABI saved to app/contracts/GameLeaderboardABI.json')
  }

  // Обновляем .env.local
  const envPath = path.join(process.cwd(), '.env.local')
  let envContent = ''

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
  }

  envContent = envContent.replace(
    /NEXT_PUBLIC_CONTRACT_ADDRESS=.*/,
    `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`
  )

  fs.writeFileSync(envPath, envContent)
  console.log('📄 .env.local updated with contract address')

  console.log('\n✅ Deployment complete!')
  console.log('📝 Next steps:')
  console.log('   1. Restart your dev server: npm run dev')
  console.log('   2. Check contract on Basescan:')
  console.log(`      https://sepolia.basescan.org/address/${address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })
