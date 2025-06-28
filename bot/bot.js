require("dotenv").config(); // For loading environment variables from .env file
const { Telegraf } = require("telegraf");
// Node's built-in fetch is available in Node.js v18+
// If using an older version, you might need a library like 'node-fetch' or 'axios'
// const fetch = require('node-fetch'); // Uncomment if using node-fetch

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_VERIFY_ENDPOINT = process.env.WEB_APP_VERIFY_ENDPOINT; // Your Next.js endpoint
const AI_CHAT_ENDPOINT = process.env.AI_CHAT_ENDPOINT || 'http://localhost:3000/api/ai/chat'; // Your AI chat endpoint

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
    // You'll need to implement this endpoint to check connection status
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

// Helper function to process AI chat
async function processAIChat(ctx, message) {
  const telegramUserId = ctx.from.id;
  const userName = ctx.from.first_name || 'User';
  
  console.log('[Bot] Processing AI chat:', {
    telegramUserId,
    userName,
    message: message.substring(0, 50) + '...',
    endpoint: AI_CHAT_ENDPOINT
  });
  
  try {
    // Send typing indicator
    await ctx.replyWithChatAction('typing');
    
    const requestBody = {
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      telegramContext: {
        userId: telegramUserId,
        userName: userName,
        chatId: ctx.chat.id
      }
    };
    
    console.log('[Bot] Sending request to AI API:', {
      url: AI_CHAT_ENDPOINT,
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

    // Simple approach: collect full response then send
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
        if (line.startsWith('0:')) {
          try {
            const content = line.substring(2); // Remove "0:" prefix
            console.log('[Bot] Raw content:', content);
            
            // The content is a JSON string, so parse it to get the actual text
            if (content.startsWith('"') && content.endsWith('"')) {
              const textContent = JSON.parse(content); // This will remove quotes and handle escaping
              console.log('[Bot] Extracted text:', textContent);
              fullResponse += textContent;
              console.log('[Bot] Current fullResponse length:', fullResponse.length);
            }
          } catch (parseError) {
            console.log('[Bot] Parse error:', parseError.message, 'for line:', line.substring(0, 100));
          }
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
    } else {
      await ctx.reply("I processed your message, but I don't have a specific response. How can I help you further?");
    }

  } catch (error) {
    console.error('AI Chat Error:', error);
    await ctx.reply('❌ Sorry, I encountered an error processing your message. Please try again or rephrase your request.');
  }
}

// Start command
bot.start((ctx) => {
  ctx.reply(
    "Welcome! I can help you connect your account.\n" +
      "Please get a connection token from the web application and then send it to me using the command:\n" +
      "/verify YOUR_TOKEN_HERE",
  );
});

// Command to verify the token
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
      // Assuming your web app sends a success message
      ctx.reply(
        responseData.message ||
          `Token verified successfully! Your Telegram User ID is ${telegramUserId} and Chat ID is ${chatId}.`,
      );
      // Here, your web app should have created an entry in `telegram_connections`
      
      // Additional welcome message with AI capabilities
      setTimeout(() => {
        ctx.reply(
          "🤖 Great! Now I'm your AI assistant. You can:\n\n" +
          "📝 Create tasks: 'Create a task to call the client tomorrow'\n" +
          "🔍 Search tasks: 'What tasks do I have today?'\n" +
          "💡 Ask questions: 'Help me prioritize my work'\n" +
          "💾 Save info: 'Remember I prefer morning meetings'\n\n" +
          "Just chat with me naturally!"
        );
      }, 1000);
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

// Help command
bot.command("help", (ctx) => {
  ctx.reply(
    "🤖 TaskGenie AI Assistant\n\n" +
    "Commands:\n" +
    "/start - Welcome message\n" +
    "/verify <token> - Connect your account\n" +
    "/help - Show this help\n\n" +
    "Once connected, just chat naturally! I can:\n" +
    "📝 Create and manage tasks\n" +
    "🔍 Search your existing tasks\n" +
    "💡 Answer questions from your knowledge\n" +
    "📊 Help with planning and priorities"
  );
});

// Generic message handler - UPDATED to include AI chat
bot.on("message", async (ctx) => {
  if (ctx.message.text && !ctx.message.text.startsWith("/")) {
    const telegramUserId = ctx.from.id;
    const userName = ctx.from.first_name || 'User';
    
    // Check if user is connected
    const connected = await isUserConnected(telegramUserId);
    
    if (connected) {
      // User is connected - process with AI
      await processAIChat(ctx, ctx.message.text);
    } else {
      // User not connected - show connection instructions
      ctx.reply(
        `👋 Hi ${userName}! I'm TaskGenie, your AI productivity assistant.\n\n` +
        `To get started, please connect your account:\n` +
        `1. Visit your TaskGenie settings page\n` +
        `2. Generate a connection token\n` +
        `3. Send me: /verify <your-token>\n\n` +
        `Once connected, I can help you manage tasks, answer questions, and more!`
      );
    }
  }
});

bot
  .launch()
  .then(() => {
    console.log("Telegram bot started successfully!");
  })
  .catch((err) => {
    console.error("Failed to start Telegram bot:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM")); 