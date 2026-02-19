# 📖 DEPLOYMENT GUIDE

## Быстрый старт

### 1. Настройка приватного ключа

Откройте `.env.local` и добавьте ваш приватный ключ:

```bash
PRIVATE_KEY=0xyour_private_key_here
```

**Как получить приватный ключ:**

1. **MetaMask:**
   - Откройте MetaMask
   - Нажмите на три точки → Account Details → Export Private Key
   - Введите пароль
   - Скопируйте ключ (начинается с `0x...`)

2. **Для Base Sepolia testnet:**
   - Добавьте сеть Base Sepolia в MetaMask:
     - Network Name: Base Sepolia
     - RPC URL: `https://sepolia.base.org`
     - Chain ID: `84532`
     - Currency Symbol: `ETH`
     - Block Explorer: `https://sepolia.basescan.org`
   
   - Получите тестовые ETH:
     - https://faucet.base.org/
     - https://sepoliafaucet.com/

### 2. Деплой контракта

```bash
# Деплой на Base Sepolia (testnet)
npm run deploy:base-sepolia

# Деплой на Base Mainnet
npm run deploy:base
```

### 3. Проверка

После деплоя:
- Адрес контракта автоматически обновится в `.env.local`
- ABI сохранится в `app/contracts/`
- Проверьте контракт на Basescan

### 4. Запуск приложения

```bash
npm run dev
```

---

## Детальная инструкция

### Шаг 1: Установка приватного ключа

**Вариант A: Использование существующего кошелька**

1. Откройте MetaMask
2. Выберите аккаунт
3. Нажмите `⋮` → Account Details → Export Private Key
4. Введите пароль
5. Скопируйте ключ
6. Вставьте в `.env.local`:
   ```
   PRIVATE_KEY=0x1234567890abcdef...
   ```

**Вариант B: Создание нового кошелька для деплоя**

1. Создайте новый аккаунт в MetaMask
2. Экспортируйте приватный ключ
3. Получите тестовые ETH (см. выше)
4. Используйте для деплоя

### Шаг 2: Деплой на Base Sepolia

```bash
npm run deploy:base-sepolia
```

**Что происходит:**
1. Компиляция контракта
2. Деплой на сеть Base Sepolia
3. Сохранение адреса контракта
4. Обновление `.env.local`

**Пример вывода:**
```
🚀 Deploying GameLeaderboard to Base Sepolia...
✅ GameLeaderboard deployed to: 0x1234567890abcdef1234567890abcdef12345678
📄 Contract info saved to app/contracts/contract-info.json
📄 ABI saved to app/contracts/GameLeaderboardABI.json
📄 .env.local updated with contract address
```

### Шаг 3: Проверка контракта

1. Откройте Basescan Sepolia:
   https://sepolia.basescan.org/address/0x1234567890abcdef1234567890abcdef12345678

2. Проверьте:
   - ✅ Контракт создан
   - ✅ Владелец — ваш адрес
   - ✅ Можно читать данные

### Шаг 4: Тестирование

1. Запустите приложение:
   ```bash
   npm run dev
   ```

2. Откройте http://localhost:3000

3. Подключите кошелёк
4. Сыграйте в игру
5. Отправьте счёт

---

## Деплой на Base Mainnet

**Внимание!** Требуется реальный ETH (не тестовый).

```bash
npm run deploy:base
```

### Стоимость деплоя

- Деплой контракта: ~0.005-0.01 ETH
- Транзакции: ~$0.01-0.05 каждая

---

## Верификация контракта

Для верификации на Basescan:

1. Получите API ключ: https://basescan.io/myapikey
2. Добавьте в `.env.local`:
   ```
   BASESCAN_API_KEY=your_api_key
   ```
3. Деплой с верификацией:
   ```bash
   npm run deploy:base-sepolia
   npm run verify
   ```

---

## Структура контракта

### Функции:

```solidity
// Ежедневный check-in
function dailyCheckIn() external returns (uint256 streak)

// Отправка счёта
function submitScore(uint256 score, uint256 nonce, bytes signature) external

// Получение лидерборда
function getLeaderboard(uint256 limit) external view returns (PlayerScore[])

// Статус check-in
function getCheckInStatus(address player) external view returns (
    uint256 lastCheckIn,
    uint256 streak,
    bool isActive
)

// Ранг игрока
function getPlayerRank(address player) external view returns (uint256, uint256)
```

### События:

```solidity
event ScoreSubmitted(address indexed player, uint256 score, uint256 streak)
event DailyCheckInCompleted(address indexed player, uint256 streak)
event LeaderboardUpdated(address indexed player, uint256 score, uint256 rank)
event WalletLinked(uint256 indexed fid, address indexed wallet)
```

---

## Troubleshooting

### Ошибка: "factory runner does not support sending transactions"

**Решение:** Добавить приватный ключ в `.env.local`

```bash
PRIVATE_KEY=0xyour_key_here
```

### Ошибка: "insufficient funds"

**Решение:** Получить тестовые ETH из крана:
- https://faucet.base.org/
- https://sepoliafaucet.com/

### Ошибка: "invalid private key"

**Решение:** Проверить формат ключа:
- Должен начинаться с `0x`
- Длина: 66 символов (включая 0x)
- Без пробелов и переносов

### Ошибка: "network mismatch"

**Решение:** Проверить сеть в MetaMask:
- Base Sepolia: Chain ID 84532
- Base Mainnet: Chain ID 8453

---

## Ссылки

- **Base Docs:** https://docs.base.org/
- **Base Faucet:** https://faucet.base.org/
- **Base Bridge:** https://bridge.base.org/
- **Basescan (Mainnet):** https://basescan.org/
- **Basescan (Sepolia):** https://sepolia.basescan.org/
- **Hardhat Docs:** https://hardhat.org/docs

---

## Безопасность

⚠️ **НИКОГДА НЕ КОММЬТЬТЕ `.env.local` В GIT!**

Файл `.env.local` уже в `.gitignore`. Проверяйте перед коммитом.

### Рекомендации:

1. Используйте отдельный кошелёк для деплоя
2. Не храните большие суммы на кошельке для деплоя
3. Для production используйте multisig кошелёк
4. Ротируйте ключи периодически

---

## Поддержка

Вопросы? Создайте issue в репозитории.
