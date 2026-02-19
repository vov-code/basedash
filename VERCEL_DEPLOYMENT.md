# 🚀 VERCEL DEPLOYMENT GUIDE

## Быстрый деплой

### Способ 1: Vercel CLI (рекомендуется)

```bash
# 1. Установи Vercel CLI (если нет)
npm i -g vercel

# 2. Залогинься
vercel login

# 3. Задеплой (первый раз — dev стенд)
vercel

# 4. Задеплой на продакшен
vercel --prod
```

### Способ 2: GitHub + Vercel

1. **Запушь код на GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - basedash ready"
   git branch -M main
   git remote add origin https://github.com/yourusername/basedash.git
   git push -u origin main
   ```

2. **Подключи репозиторий в Vercel:**
   - Зайди на https://vercel.com/new
   - Импортируй репозиторий `basedash`
   - Нажми **Deploy**

---

## 🔐 Настройка переменных окружения

### В Vercel Dashboard:

1. Зайди в проект → **Settings** → **Environment Variables**
2. Добавь переменные:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Production, Preview, Development |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xEEB40d65dE99f134a4763d0fe25b4dED439eFBAb` | All |
| `NEXT_PUBLIC_USE_TESTNET` | `true` | All |
| `NEXT_PUBLIC_MINIKIT_APP_ID` | (если есть) | All |
| `PRIVATE_KEY` | `0xe09f73144ebfd63a320f3c010fe64c46634353d9ac8b1ab1dcce42f775ee0a1b` | All (для деплоя контракта) |
| `SCORE_SIGNER_PRIVATE_KEY` | (тот же или новый) | All (для подписи очков) |

3. Нажми **Save**

---

## 📁 Файлы для деплоя

### ✅ Уже созданы:
- `vercel.json` — конфигурация Vercel
- `.vercelignore` — игнор файлы (создадим ниже)
- `next.config.js` — оптимизирован для Vercel

### ⚠️ Важно:

**НЕ КОММЬТЬТЕ В GIT:**
- `.env.local`
- `.env`
- `node_modules/`
- `.next/`

Эти файлы уже в `.gitignore`.

---

## 🎯 Пошаговая инструкция

### Шаг 1: Подготовка

```bash
# Убедись что всё работает локально
npm run dev

# Проверь сборку
npm run build
```

### Шаг 2: Git

```bash
# Инициализация (если нет git)
git init

# Добавь файлы
git add .
git commit -m "🚀 basedash ready for production"
```

### Шаг 3: Деплой через CLI

```bash
# Установи Vercel CLI
npm install -g vercel

# Логин
vercel login

# Деплой
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? (выбери аккаунт)
# - Link to existing project? N (первый раз)
# - Project name? basedash
# - Directory? ./
# - Override settings? N

# Продакшен деплой
vercel --prod
```

### Шаг 4: Настройка домена

1. В Vercel Dashboard: **Project** → **Settings** → **Domains**
2. Добавь свой домен (опционально)
3. Обнови DNS записи

### Шаг 5: Обновление переменных

После первого деплоя:
1. Скопируй URL из Vercel (например, `https://basedash.vercel.app`)
2. Обнови `NEXT_PUBLIC_APP_URL` в Vercel Dashboard
3. Redeploy: `vercel --prod`

---

## 🔧 Troubleshooting

### Ошибка: "Build failed"

**Проверь логи:**
```bash
vercel logs
```

**Частые проблемы:**
1. ❌ Нет переменных окружения → Добавь в Vercel Dashboard
2. ❌ Ошибка TypeScript → `npm run build` локально
3. ❌ Мало памяти → Vercel Free tier имеет лимиты

### Ошибка: "Module not found"

```bash
# Очисти кэш
rm -rf node_modules .next
npm install
npm run build
```

### Ошибка: "API route not working"

Проверь что API routes в `app/api/` работают:
- `/api/score-sign` — требует `SCORE_SIGNER_PRIVATE_KEY`
- `/api/leaderboard` — читает из контракта
- `/api/daily-checkin` — check-in логика

---

## 📊 Vercel Free Tier Limits

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Serverless Function Executions | 100 GB-hours |
| Build Minutes | 6,000 minutes/month |
| Middleware Invocations | 1M/month |

**Для basedash:**
- ✅ Хватит для ~10K игроков/month
- ✅ API calls минимальные
- ✅ Static assets кэшируются

---

## 🎨 Base Mini App Setup

### Для интеграции с Base:

1. **Создай Mini App:**
   - https://base.org/developers/mini-apps
   - Добавь URL: `https://basedash.vercel.app`

2. **Обнови `app/.well-known/farcaster.json`:**
   ```json
   {
     "accountAssociation": {
       "header": "...",
       "payload": "...",
       "signature": "..."
     }
   }
   ```

3. **Получи `NEXT_PUBLIC_MINIKIT_APP_ID`**
4. **Добавь в Vercel Environment Variables**

---

## 📈 Performance Tips

### Оптимизация для Vercel:

1. ✅ **Image Optimization:**
   - Использует Next.js Image
   - Автоматическое сжатие

2. ✅ **Static Generation:**
   - Главная страница статическая
   - API routes server-side

3. ✅ **Edge Caching:**
   - Vercel Edge Network кэширует статику
   - API responses можно кэшировать

4. ✅ **Bundle Size:**
   - Текущий JS: ~165KB (норма)
   - Game canvas оптимизирован

---

## 🎉 Checklist перед деплоем

- [ ] Контракт задеплоен на Base Sepolia
- [ ] `NEXT_PUBLIC_CONTRACT_ADDRESS` установлен
- [ ] Локальная сборка работает: `npm run build`
- [ ] Git репозиторий создан
- [ ] Vercel аккаунт подключён
- [ ] Переменные окружения добавлены
- [ ] `.env` файлы НЕ в git

---

## 🔗 Ссылки

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel CLI Docs:** https://vercel.com/docs/cli
- **Next.js on Vercel:** https://nextjs.org/docs/deployment
- **Base Mini Apps:** https://docs.base.org/mini-apps/

---

## 💡 Pro Tips

1. **Preview Deployments:**
   - Каждый пул-реквест = preview URL
   - Тестируй изменения перед продакшеном

2. **Analytics:**
   - Включи Vercel Analytics
   - Мониторь производительность

3. **Custom Domain:**
   - Купи домен (namecheap, porkbun)
   - Подключи в Vercel

4. **Auto-deploy:**
   - Подключи GitHub
   - Push → Auto deploy

---

**Готов к деплою? Запускай:**
```bash
vercel --prod
```
