import "dotenv/config";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.3,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是一个简洁、有帮助的中文助手，会用 1-2 句话回答用户问题，重点给出明确、有用的信息。",
  ],
  // 这里用 MessagesPlaceholder 来承载「之前的多轮对话」,会被历史消息占位替换。
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
]);

// 用 Prompt 生成 LLM 输入。
// .pipe(StringOutputParser()) → 将模型输出解析为纯字符串。
const simpleChain = prompt.pipe(model).pipe(new StringOutputParser());

const messageHistories = new Map();

const getMessageHistory = (sessionId) => {
  if (!messageHistories.has(sessionId)) {
    messageHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return messageHistories.get(sessionId);
};

// 创建带消息历史的链
const chain = new RunnableWithMessageHistory({
  // 实际问答链，负责输出回答。
  runnable: simpleChain,
  // 根据 sessionId 获取历史消息。
  getMessageHistory: (sessionId) => getMessageHistory(sessionId),
  // 输入消息的 key。
  inputMessagesKey: "question",
  // 历史消息的 key。
  historyMessagesKey: "history",
});

// 测试：第一次对话
console.log("--- 第一次对话（提供信息） ---");
const result1 = await chain.invoke(
  {
    question: "我的名字是神光，我来自山东，我喜欢编程、写作、金铲铲。",
  },
  {
    configurable: {
      sessionId: "user-123",
    },
  }
);
console.log("问题: 我的名字是神光，我来自山东，我喜欢编程、写作、金铲铲。");
console.log("回答:", result1);
console.log();

// 测试：第二次对话
console.log("--- 第二次对话（询问之前的信息） ---");
const result2 = await chain.invoke(
  {
    question: "我刚才说我来自哪里？",
  },
  {
    configurable: {
      sessionId: "user-123",
    },
  }
);
console.log("问题: 我刚才说我来自哪里？");
console.log("回答:", result2);
console.log();

// 测试：第三次对话
console.log("--- 第三次对话（继续询问） ---");
const result3 = await chain.invoke(
  {
    question: "我的爱好是什么？",
  },
  {
    configurable: {
      sessionId: "user-123",
    },
  }
);
console.log("问题: 我的爱好是什么？");
console.log("回答:", result3);
console.log();

// 测试：第四次对话
console.log("--- 第四次对话（继续询问） ---");
const result4 = await chain.invoke(
  {
    question: "我的邮箱是什么？",
  },
  {
    configurable: {
      sessionId: "user-1231",
    },
  }
);
console.log("问题: 我的邮箱是什么？");
console.log("回答:", result4);
