# base dash - endless runner on base blockchain

endless runner game with on-chain leaderboard for base mini app

---

## features

- endless gameplay with procedural generation
- minimal ui design inspired by base
- on-chain leaderboard - all scores saved on base blockchain
- daily check-in system for score submission
- mobile-first responsive design
- optimized for 60 fps

---

## quick start

### 1. install

```bash
git clone https://github.com/yourusername/base-dash.git
cd base-dash
npm install
```

### 2. setup

```bash
cp .env.example .env.local
```

edit `.env.local` and add your private key.

### 3. deploy contract

```bash
npm run deploy:base-sepolia
```

copy the contract address to `.env.local`.

### 4. run

```bash
npm run dev
```

open **http://localhost:3000**

---

---

## gameplay

### controls
- **space / click / tap** - jump
- **hold** - continuous jumps

### obstacles
- red spikes - instant death
- white blocks - solid obstacles  
- blue platforms - require precise jump

### scoring
- +10 for each obstacle passed
- speed increases over time
- max speed: 15

---

## project structure

```
base-dash/
├── app/
│   ├── .well-known/farcaster.json    # base mini app manifest
│   ├── api/                          # api endpoints
│   ├── components/                   # react components
│   │   ├── game/gamecanvas.tsx       # game
│   │   ├── leaderboard/leaderboard.tsx
│   │   └── dailycheckin/checkinbutton.tsx
│   ├── contracts/                    # contract abi
│   ├── hooks/                        # custom hooks
│   ├── lib/                          # utilities
│   ├── styles/globals.css            # global styles
│   ├── layout.tsx
│   └── page.tsx
├── contracts/gameleaderboard.sol     # smart contract
├── public/                           # static files
│   ├── icons/                        # pwa icons
│   ├── screenshots/                  # screenshots
│   ├── hero.svg                      # hero image
│   └── manifest.json                 # pwa manifest
├── scripts/deploy.ts                 # deploy script
├── minikit.config.ts                 # mini app config
└── deployment.md                     # deployment guide
```

---

## commands

```bash
# development
npm run dev              # dev server

# build
npm run build            # production build
npm run start            # production server

# smart contracts
npm run compile          # compile
npm run deploy:base-sepolia  # deploy to testnet
npm run deploy:base          # deploy to mainnet
npm run verify           # verify

# linting
npm run lint             # code check
```

---

## 📱 Base Mini App

### Требования
- ✅ Публичный HTTPS домен
- ✅ Манифест по адресу `/.well-known/farcaster.json`
- ✅ Account Association от base.dev
- ✅ Отключённый Vercel Deployment Protection

### Публикация

1. **Деплой на Vercel**
   ```bash
   vercel
   ```

2. **Генерация accountAssociation**
   - Перейдите на [base.dev/account-association](https://base.dev/account-association)
   - Введите ваш домен
   - Скопируйте учётные данные

3. **Обновление конфигурации**
   - Вставьте `accountAssociation` в `minikit.config.ts`
   - Обновите все URL на ваш домен

4. **Валидация**
   - Проверьте на [base.dev/preview](https://base.dev/preview)

5. **Публикация**
   - Создайте пост в Base app с URL

---

## 🎨 Дизайн

### Цветовая палитра
- **Base Blue**: `#0052FF`
- **Base Dark**: `#0033AA`
- **Base Light**: `#3378FF`
- **Success**: `#00D924`
- **Warning**: `#FFB800`
- **Error**: `#FF3B30`

### Градиенты
```css
--gradient-primary: linear-gradient(135deg, #0052FF 0%, #0033AA 100%)
--gradient-hero: linear-gradient(180deg, #0052FF 0%, #001F66 100%)
--gradient-game: linear-gradient(180deg, #0A1628 0%, #1a3a8a 50%, #0052FF 100%)
```

### Анимации
- `fade-in`, `fade-in-up`, `scale-in`
- `pulse-glow`, `float`, `slide-in-right`
- `bounce`, `spin`

---

## 📊 Смарт-контракт

### Функции

```solidity
// Ежедневный check-in
function dailyCheckIn() external returns (uint256 streak)

// Отправка счёта
function submitScore(uint256 score) external

// Получение лидерборда
function getLeaderboard(uint256 limit) external view returns (PlayerScore[])

// Статус check-in
function getCheckInStatus(address player) external view returns (
    uint256 lastCheckIn,
    uint256 streak,
    bool isActive
)
```

### События
- `DailyCheckInCompleted(address indexed player, uint256 streak)`
- `ScoreSubmitted(address indexed player, uint256 score, uint256 streak)`
- `LeaderboardUpdated(address indexed player, uint256 score, uint256 rank)`

---

## 🛠 Технологии

- **Frontend**: Next.js 14, React 18, TypeScript
- **Стили**: Tailwind CSS, CSS Variables
- **Blockchain**: Wagmi, Viem, Base
- **Смарт-контракты**: Solidity 0.8, Hardhat
- **State**: React Query, localStorage
- **Анимации**: CSS Keyframes

---

## 📄 Документация

- [README.md](README.md) - основная документация
- [DEPLOYMENT.md](DEPLOYMENT.md) - полное руководство по деплою
- [RUN_INSTRUCTIONS.md](RUN_INSTRUCTIONS.md) - инструкция по запуску

---

## 🔗 Ссылки

- [Base Documentation](https://docs.base.org/mini-apps)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-faucet)
- [Basescan](https://basescan.org)
- [Vercel](https://vercel.com)
- [Wagmi](https://wagmi.sh)

---

## 📝 License

MIT License - см. [LICENSE](LICENSE) файл.

---

## 🙏 Благодарности

- **Base** - за платформу и Mini Apps SDK
- **Geometry Dash** - за вдохновение
- **Wagmi/Viem** - за отличные библиотеки

---

## 🎮 Готово к запуску!

```bash
# 1. Деплой контракта
npm run deploy:base-sepolia

# 2. Запуск
npm run dev
```

**Удачи в игре! 🚀**
