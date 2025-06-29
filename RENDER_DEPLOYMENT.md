# 🚀 Deploy TaskGenie Telegram Bot to Render

## ✅ **Prerequisites**
- GitHub repository with your bot code
- Telegram bot token from @BotFather
- TaskGenie web app running (https://taskgenie-ai.vercel.app)

## 🌐 **Step 1: Create Render Web Service**

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `pranavjana/taskgenie-telegram`
4. Configure the service:
   - **Name**: `taskgenie-telegram-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (0GB RAM, sleeps after 15min of inactivity)

## 🔧 **Step 2: Set Environment Variables**

In your Render service settings, add these environment variables:

### Required Variables:
```
TELEGRAM_BOT_TOKEN = your_bot_token_from_botfather
WEB_APP_VERIFY_ENDPOINT = https://taskgenie-ai.vercel.app/api/telegram/verify
WEBHOOK_URL = https://taskgenie-telegram-bot.onrender.com
```

⚠️ **Important**: Replace `taskgenie-telegram-bot` in the webhook URL with your actual Render service name.

### Optional Variables:
```
PORT = 3000
```
(Render automatically sets PORT, but you can override if needed)

## 🤖 **Step 3: Deploy**

1. Click **"Create Web Service"**
2. Render will automatically deploy from your GitHub repo
3. Wait for the build to complete (2-3 minutes)
4. Your bot will be available at: `https://your-service-name.onrender.com`

## ✅ **Step 4: Verify Deployment**

1. **Health Check**: Visit your service URL - you should see:
   ```json
   {
     "status": "TaskGenie Telegram Bot is running!",
     "timestamp": "2024-01-XX...",
     "features": ["welcome messages", "account verification", "reminder notifications"]
   }
   ```

2. **Bot Test**: Send `/start` to your bot on Telegram

3. **Logs**: Check Render logs for startup messages:
   ```
   🌐 Starting in WEBHOOK mode...
   📡 Webhook set to: https://your-app.onrender.com/webhook
   🚀 TaskGenie Telegram bot started successfully!
   ```

## 🔄 **Development vs Production**

### Local Development (Polling):
```bash
# Only set these in your local .env file
TELEGRAM_BOT_TOKEN=your_token
WEB_APP_VERIFY_ENDPOINT=https://taskgenie-ai.vercel.app/api/telegram/verify
# Don't set WEBHOOK_URL for local development
```

### Production (Webhooks):
```bash
# Set all variables including WEBHOOK_URL in Render
TELEGRAM_BOT_TOKEN=your_token
WEB_APP_VERIFY_ENDPOINT=https://taskgenie-ai.vercel.app/api/telegram/verify
WEBHOOK_URL=https://your-service.onrender.com
```

## 💡 **Free Tier Limitations**

- **Sleep after 15 minutes** of inactivity
- **30-60 second cold start** when waking up
- **750 hours/month** total runtime
- Bot will wake up automatically when someone sends a message

## 🔧 **Troubleshooting**

### Bot not responding:
1. Check Render logs for errors
2. Verify environment variables are set correctly
3. Ensure webhook URL matches your service URL exactly
4. Test the health check endpoint

### Webhook errors:
1. Check that `WEBHOOK_URL` in environment variables matches your Render service URL
2. Verify the webhook endpoint is accessible: `https://your-app.onrender.com/webhook`

### Build failures:
1. Ensure `package.json` has correct start script: `"start": "node bot/bot.js"`
2. Check that all dependencies are in `package.json`

## 🎉 **You're All Set!**

Your TaskGenie Telegram bot is now running on Render with webhooks! The bot will:
- ✅ Handle user verification with your web app
- ✅ Send professional welcome messages
- ✅ Provide help and guidance
- ✅ Wake up automatically when users interact
- ✅ Scale to zero when not in use (free tier) 