require("dotenv").config(); // For loading environment variables from .env file
const { Telegraf } = require("telegraf");
const { fmt, bold, italic, link } = require("telegraf/format");
const express = require("express");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_VERIFY_ENDPOINT = process.env.WEB_APP_VERIFY_ENDPOINT; // Your Next.js endpoint
const WEBHOOK_URL = process.env.WEBHOOK_URL; // For production webhook
const PORT = process.env.PORT || 3000; // Port for Express server
// const AI_CHAT_ENDPOINT = process.env.AI_CHAT_ENDPOINT || 'http://localhost:3000/api/ai/chat'; // Fixed default port
// const CONVERSATION_ENDPOINT = process.env.CONVERSATION_ENDPOINT || 'http://localhost:3000/api/telegram/conversation'; // Fixed default port

// Debug environment variables
console.log('[Bot] Environment variables loaded:', {
  BOT_TOKEN: BOT_TOKEN ? 'Set' : 'Missing',
  WEB_APP_VERIFY_ENDPOINT,
  // AI_CHAT_ENDPOINT,
  // CONVERSATION_ENDPOINT
});

if (!BOT_TOKEN) {
  console.error(
    "Error: TELEGRAM_BOT_TOKEN is missing in your .env file or environment variables.",
  );
  process.exit(1);
}
if (!WEB_APP_VERIFY_ENDPOINT) {
  console.error(
    "Error: WEB_APP_VERIFY_ENDPOINT is missing in your .env file or environment variables.",
  );
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Helper function to check if user is connected
async function isUserConnected(telegramUserId) {
  try {
    const response = await fetch(`${WEB_APP_VERIFY_ENDPOINT.replace('/verify', '/check-connection')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramUserId: telegramUserId.toString()
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.connected || false;
    }
    return false;
  } catch (error) {
    console.error('Error checking user connection:', error);
    return false;
  }
}

// COMMENTED OUT: Conversation history and AI chat functionality
/*
// Helper function to get conversation history
async function getConversationHistory(telegramUserId) {
  try {
    const response = await fetch(`${CONVERSATION_ENDPOINT}?telegramUserId=${telegramUserId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.history || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

// Helper function to check if context should be included
function shouldIncludeContext(userMessage, historyLength, conversationHistory = []) {
  if (historyLength === 0) return false;
  
  // Check if the last message was a question - if so, short responses likely need context
  if (conversationHistory.length > 0) {
    const lastAssistantMessage = conversationHistory
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    if (lastAssistantMessage && lastAssistantMessage.content.includes('?')) {
      // If the user's message is short (likely an answer), include context
      if (userMessage.trim().split(' ').length <= 3) {
        console.log('[Bot] Short response after question detected, including context');
        return true;
      }
    }
  }
  
  const contextTriggers = [
    // Reference to previous conversation
    /\b(this|that|these|those|it|them)\b/i,
    /\b(the one|the task|the project|the reminder)\b/i,
    
    // Follow-up words
    /\b(also|additionally|furthermore|moreover|and|plus)\b/i,
    /\b(continue|keep going|more|another)\b/i,
    
    // Clarification requests
    /\b(what about|what if|how about)\b/i,
    /\b(instead|rather|or)\b/i,
    
    // Task/project context references
    /\b(add it|create it|make it|do it|set it)\b/i,
    /\b(for today|for tomorrow|for this week)\b/i,
    /\b(to that|with that|about that)\b/i,
    
    // Questions that might need context
    /^(yes|no|sure|ok|okay|alright)\b/i,
    /^(can you|could you|would you|will you)\b/i,
    
    // Ambiguous references
    /\b(same|similar|like before|as mentioned)\b/i,
    /\b(the project|the task|the reminder|the meeting)\b/i
  ];

  return contextTriggers.some(trigger => trigger.test(userMessage));
}

// Helper function to add message to conversation history
async function addToConversationHistory(telegramUserId, role, content) {
  try {
    await fetch(CONVERSATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegramUserId: telegramUserId.toString(),
        role: role,
        content: content
      })
    });
  } catch (error) {
    console.error('Error adding to conversation history:', error);
  }
}

// Helper function to process AI chat with intelligent context
async function processAIChat(ctx, message) {
  const telegramUserId = ctx.from.id;
  const userName = ctx.from.first_name || 'User';
  
  console.log('[Bot] Processing AI chat:', {
    telegramUserId,
    userName,
    message: message.length > 100 ? message.substring(0, 100) + '...' : message, // Show more of the message
    fullMessage: message, // Log the full message for debugging
    endpoint: AI_CHAT_ENDPOINT
  });
  
  try {
    // Send typing indicator
    await ctx.replyWithChatAction('typing');
    
    // Get conversation history and decide if context should be included
    const conversationHistory = await getConversationHistory(telegramUserId);
    const includeContext = shouldIncludeContext(message, conversationHistory.length, conversationHistory);
    
    console.log(`[Bot] Conversation context: ${conversationHistory.length} messages, include context: ${includeContext}`);
    
    // Build messages array with intelligent context inclusion
    let messages;
    
    if (includeContext && conversationHistory.length > 0) {
      // Include recent conversation history for context
      messages = [
        ...conversationHistory,
        {
          role: 'user',
          content: message
        }
      ];
      console.log(`[Bot] Including ${conversationHistory.length} previous messages for context`);
    } else {
      // Use just the current message
      messages = [
        {
          role: 'user',
          content: message
        }
      ];
      console.log('[Bot] Processing message without historical context');
    }
    
    const requestBody = {
      messages: messages,
      telegramContext: {
        userId: telegramUserId,
        userName: userName,
        chatId: ctx.chat.id
      }
    };
    
    console.log('[Bot] Sending request to AI API:', {
      url: AI_CHAT_ENDPOINT,
      messageCount: messages.length,
      hasContext: includeContext,
      bodyPreview: JSON.stringify(requestBody).substring(0, 200) + '...'
    });
    
    const response = await fetch(AI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Bot] AI API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Bot] AI API error response:', errorText);
      throw new Error(`AI service error: ${response.statusText}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    console.log('[Bot] Starting to read streaming response...');
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      const chunk = decoder.decode(value);
      console.log(`[Bot] Chunk ${chunkCount}:`, chunk.substring(0, 200) + '...');
      
      const lines = chunk.split('\n');

      for (const line of lines) {
        console.log('[Bot] Processing line:', line.substring(0, 150));
        
        // Handle different streaming formats
        if (line.startsWith('0:')) {
          try {
            const content = line.substring(2); // Remove "0:" prefix
            console.log('[Bot] Raw content (0:):', content);
            
            // The content is a JSON string, so parse it to get the actual text
            if (content.startsWith('"') && content.endsWith('"')) {
              const textContent = JSON.parse(content); // This will remove quotes and handle escaping
              console.log('[Bot] Extracted text:', textContent);
              fullResponse += textContent;
              console.log('[Bot] Current fullResponse length:', fullResponse.length);
            }
          } catch (parseError) {
            console.log('[Bot] Parse error (0:):', parseError.message, 'for line:', line.substring(0, 100));
          }
        } else if (line.startsWith('1:')) {
          // Handle text delta format
          try {
            const content = line.substring(2); // Remove "1:" prefix
            console.log('[Bot] Raw content (1:):', content);
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'string') {
              fullResponse += parsed;
              console.log('[Bot] Added text delta:', parsed);
            } else if (parsed && parsed.textDelta) {
              fullResponse += parsed.textDelta;
              console.log('[Bot] Added textDelta:', parsed.textDelta);
            }
          } catch (parseError) {
            console.log('[Bot] Parse error (1:):', parseError.message, 'for line:', line.substring(0, 100));
          }
        } else if (line.startsWith('2:') || line.startsWith('8:') || line.startsWith('9:')) {
          // Handle other stream events (tool calls, etc.)
          try {
            const content = line.substring(2);
            const parsed = JSON.parse(content);
            console.log('[Bot] Stream event:', line.substring(0, 2), typeof parsed === 'object' ? Object.keys(parsed) : parsed);
          } catch (parseError) {
            console.log('[Bot] Parse error (other):', parseError.message, 'for line:', line.substring(0, 100));
          }
        } else if (line.trim() && !line.startsWith('data:')) {
          console.log('[Bot] Unrecognized line format:', line.substring(0, 100));
        }
      }
    }

    console.log('[Bot] Final fullResponse:', fullResponse.substring(0, 200) + '...');
    console.log('[Bot] Final fullResponse length:', fullResponse.length);

    // Send final response
    if (fullResponse.trim()) {
      // Split long messages to avoid Telegram limits
      const maxLength = 4000;
      if (fullResponse.length > maxLength) {
        const chunks = [];
        for (let i = 0; i < fullResponse.length; i += maxLength) {
          chunks.push(fullResponse.slice(i, i + maxLength));
        }
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } else {
        await ctx.reply(fullResponse.trim());
      }
      
      // Store conversation history (both user message and AI response)
      // Note: The API endpoint already stores these, but we can also store them here for redundancy
      await addToConversationHistory(telegramUserId, 'user', message);
      await addToConversationHistory(telegramUserId, 'assistant', fullResponse.trim());
      
    } else {
      const fallbackResponse = "I processed your message, but I don't have a specific response. How can I help you further?";
      await ctx.reply(fallbackResponse);
      
      // Store conversation history
      await addToConversationHistory(telegramUserId, 'user', message);
      await addToConversationHistory(telegramUserId, 'assistant', fallbackResponse);
    }

  } catch (error) {
    console.error('AI Chat Error:', error);
    const errorResponse = '❌ Sorry, I encountered an error processing your message. Please try again or rephrase your request.';
    await ctx.reply(errorResponse);
    
    // Store error in conversation history
    await addToConversationHistory(telegramUserId, 'user', message);
    await addToConversationHistory(telegramUserId, 'assistant', errorResponse);
  }
}
*/

// Start command - Production ready welcome message
bot.start((ctx) => {
  const userName = ctx.from.first_name || 'there';
  ctx.reply(fmt`🚀 Welcome to TaskGenie, ${userName}!

TaskGenie is your intelligent productivity assistant that helps you stay organized and on top of your tasks.

🤖 ${bold`AI Features`}: Currently in development - look out for exciting AI-powered task management coming soon!

🔔 ${bold`Available Now`}: Reminder notifications to keep you on track with your important tasks and deadlines.

📱 ${bold`Get Started`}: Connect your TaskGenie account to receive personalized notifications:
1. Visit your TaskGenie web app at ${link('taskgenie-ai.vercel.app', 'https://taskgenie-ai.vercel.app/')}
2. Go to Settings → Telegram Integration
3. Generate a connection token
4. Send me: /verify YOUR_TOKEN_HERE

🎯 Once connected, you'll receive timely reminders for all your important tasks!

Need help? Just type /help for more information.`);
});

// Command to verify the token (KEEPING THIS - Identity verification functionality)
bot.command("verify", async (ctx) => {
  const text = ctx.message.text;
  const parts = text.split(" "); // Split the command and the token

  if (parts.length < 2 || !parts[1]) {
    return ctx.reply(
      "Please provide a token after /verify. Usage: /verify YOUR_TOKEN_HERE",
    );
  }

  const userProvidedToken = parts[1];
  const telegramUserId = ctx.from.id; // Sender's Telegram User ID
  const chatId = ctx.chat.id; // Chat ID where the message was sent

  ctx.reply(`Attempting to verify token: ${userProvidedToken}...`);

  try {
    const response = await fetch(WEB_APP_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: userProvidedToken,
        telegramUserId: telegramUserId, // Send these to your backend
        chatId: chatId, // Send these to your backend
      }),
    });

    const responseData = await response.json();

    if (response.ok) {
      // Success message for verification
      ctx.reply(
        responseData.message ||
          fmt`✅ ${bold`Account Connected Successfully!`}

🎉 Great news! Your TaskGenie account is now connected to Telegram.

🔔 ${bold`What's Next:`}
• You'll now receive reminder notifications for your tasks
• Get alerts for upcoming deadlines
• Stay on top of your productivity goals

🤖 ${bold`Coming Soon:`} AI-powered task management and smart conversations!

Your connection details:
📱 Telegram ID: ${telegramUserId}
💬 Chat ID: ${chatId}`
      );
      
              // Additional welcome message for connected users
        setTimeout(() => {
          ctx.reply(fmt`🚀 ${bold`You're all set!`}

Your TaskGenie notifications are now active. Here's what you can expect:

📅 ${bold`Daily Reminders`} - Never miss an important task
⏰ ${bold`Deadline Alerts`} - Stay ahead of due dates
🎯 ${bold`Goal Tracking`} - Keep your productivity on track

💡 ${bold`Pro Tip:`} Make sure to enable notifications in your Telegram settings to get the most out of TaskGenie!

Questions? Type /help anytime.`);
        }, 2000);
    } else {
      // Assuming your web app sends an error message
      ctx.reply(
        `Verification failed: ${responseData.error || response.statusText || "Unknown error"}`,
      );
    }
  } catch (error) {
    console.error("Error sending token to web app:", error);
    ctx.reply(
      "Sorry, there was an error communicating with the verification service. Please try again later.",
    );
  }
});

// COMMENTED OUT: Clear command
/*
// Command to clear conversation history
bot.command("clear", async (ctx) => {
  const telegramUserId = ctx.from.id;
  
  try {
    const response = await fetch(`${CONVERSATION_ENDPOINT}?telegramUserId=${telegramUserId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      ctx.reply("🧹 Conversation history cleared! Starting fresh.");
    } else {
      ctx.reply("❌ Failed to clear conversation history. Please try again.");
    }
  } catch (error) {
    console.error("Error clearing conversation history:", error);
    ctx.reply("❌ Error clearing conversation history. Please try again later.");
  }
});
*/

// Help command - Production ready help message
bot.command("help", (ctx) => {
  ctx.reply(fmt`🤖 ${bold`TaskGenie Bot Help`}

${bold`Available Commands:`}
/start - Show welcome message
/verify <token> - Connect your TaskGenie account
/help - Show this help message

${bold`Current Features:`}
🔔 ${bold`Reminder Notifications`} - Get notified about your important tasks and deadlines

${bold`Coming Soon:`}
🤖 ${bold`AI Assistant`} - Smart task management with conversation memory
📝 ${bold`Task Creation`} - Create tasks directly through chat
🔍 ${bold`Smart Search`} - Find tasks using natural language
💡 ${bold`Context Understanding`} - AI that remembers your preferences

${bold`Getting Started:`}
1. Make sure you have a TaskGenie account at ${link('taskgenie-ai.vercel.app', 'https://taskgenie-ai.vercel.app/')}
2. Generate a connection token in your web app settings
3. Use /verify <your-token> to connect
4. Start receiving notifications!

${bold`Need Support?`}
Visit our help center or contact support through the TaskGenie web app.`);
});

// Message handler for production - handles unconnected users
bot.on("message", async (ctx) => {
  if (ctx.message.text && !ctx.message.text.startsWith("/")) {
    const telegramUserId = ctx.from.id;
    const userName = ctx.from.first_name || 'there';
    
    // Check if user is connected
    const connected = await isUserConnected(telegramUserId);
    
          if (connected) {
        // User is connected - for now, just acknowledge (AI features coming soon)
        ctx.reply(fmt`👋 Hi ${userName}! Thanks for your message.

🤖 ${bold`AI chat features are currently in development`} and will be available soon!

For now, you're all set to receive reminder notifications for your TaskGenie tasks.

Need help? Type /help for more information.`);
          } else {
        // User not connected - show connection instructions
        ctx.reply(fmt`👋 Hi ${userName}! I see you're trying to chat with me.

🔗 ${bold`First, let's connect your TaskGenie account`} so you can receive reminder notifications:

1. Visit your TaskGenie web app at ${link('taskgenie-ai.vercel.app', 'https://taskgenie-ai.vercel.app/')}
2. Go to Settings → Telegram Integration
3. Generate a connection token
4. Send me: /verify YOUR_TOKEN_HERE

🚀 Once connected, you'll be ready for our upcoming AI features!

Type /help for more information.`);
    }
  }
});

// TODO: Add reminder notification functionality here
// This is where you would add code to handle sending reminder notifications to users

// Create Express app for webhook
const app = express();
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "TaskGenie Telegram Bot is running!",
    timestamp: new Date().toISOString(),
    features: ["welcome messages", "account verification", "reminder notifications"]
  });
});

// Webhook endpoint
app.post("/webhook", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Start the server
async function startBot() {
  try {
    if (WEBHOOK_URL) {
      // Production mode - use webhooks
      console.log("🌐 Starting in WEBHOOK mode...");
      
      // Set webhook
      await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
      console.log(`📡 Webhook set to: ${WEBHOOK_URL}/webhook`);
      
      // Start Express server
      app.listen(PORT, () => {
        console.log("🚀 TaskGenie Telegram bot started successfully!");
        console.log(`🌐 Server running on port ${PORT}`);
        console.log("✅ Production features active:");
        console.log("   • Welcome messages");
        console.log("   • Account verification");
        console.log("   • User guidance");
        console.log("   • Help system");
        console.log("🔄 Ready for reminder notifications");
        console.log("🤖 AI features: In development");
      });
    } else {
      // Development mode - use polling
      console.log("🔄 Starting in POLLING mode (development)...");
      await bot.launch();
      console.log("🚀 TaskGenie Telegram bot started successfully!");
      console.log("✅ Development features active:");
      console.log("   • Welcome messages");
      console.log("   • Account verification");
      console.log("   • User guidance");
      console.log("   • Help system");
      console.log("🔄 Ready for reminder notifications");
      console.log("🤖 AI features: In development");
    }
  } catch (error) {
    console.error("❌ Failed to start TaskGenie Telegram bot:", error);
    process.exit(1);
  }
}

// Start the bot
startBot();

// Enable graceful stop
process.once("SIGINT", () => {
  console.log("🛑 Stopping TaskGenie bot...");
  if (WEBHOOK_URL) {
    bot.telegram.deleteWebhook().then(() => {
      console.log("📡 Webhook deleted");
      process.exit(0);
    });
  } else {
    bot.stop("SIGINT");
  }
});

process.once("SIGTERM", () => {
  console.log("🛑 Stopping TaskGenie bot...");
  if (WEBHOOK_URL) {
    bot.telegram.deleteWebhook().then(() => {
      console.log("📡 Webhook deleted");
      process.exit(0);
    });
  } else {
    bot.stop("SIGTERM");
  }
}); 