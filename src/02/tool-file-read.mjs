import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import fs from "node:fs/promises";
import { z } from "zod";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || "qwen-coder-turbo",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义 Tool（核心）
const readFileTool = tool(
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, "utf-8");
    console.log(
      `[工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`
    );
    return `文件内容:\n${content}`;
  },
  {
    name: "read_file", // 定义一个工具：read_file
    description:
      "用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。",
    // 模型会根据这个 schema 自动生成 tool call 参数。
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
  }
);

const tools = [readFileTool];

// 绑定工具到模型, 让模型知道自己可以调用哪些工具
const modelWithTools = model.bindTools(tools);

// SystemMessage: 定义系统消息，告诉模型它的角色和可用工具
// HumanMessage: 用户消息，用户请求读取文件并解释代码
const messages = [
  new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）
`),
  new HumanMessage("请读取 src/2/tool-file-read.mjs 文件内容并解释代码"),
];

// 第一次调用模型，模型会根据用户请求决定是否调用工具：用户要求读取文件 → 需要调用 read_file
// 所以 response 不是最终回答，而是：response.tool_calls 包含了模型想要调用的工具信息。
// invoke 解释在最下方
let response = await modelWithTools.invoke(messages);

console.log("response.tool_calls", response.tool_calls);

messages.push(response);

// 检测 tool call（核心循环）
// 意思是：只要模型继续提出工具调用，就一直执行工具并将结果反馈给模型，直到模型不再提出工具调用，直接给出最终回答。
// 这就是 Agent loop。
while (response.tool_calls && response.tool_calls.length > 0) {
  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);

  // 执行所有工具调用
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        return `错误: 找不到工具 ${toolCall.name}`;
      }

      console.log(
        `  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`
      );
      try {
        const result = await tool.invoke(toolCall.args);
        return result;
      } catch (error) {
        return `错误: ${error.message}`;
      }
    })
  );

  // 将工具结果添加到消息历史
  // 非常关键：模型提出了工具调用，工具执行后我们把结果作为 ToolMessage 反馈给模型，模型才能基于工具结果继续推理。
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      })
    );
  });

  // 再次调用模型，传入工具结果
  response = await modelWithTools.invoke(messages);
  
  console.log("response.tool_calls2", response.tool_calls);
}

console.log("\n[最终回复]");
console.log(response.content);

// invoke 方法解释：invoke() = 执行一次 AI 推理（输入 → 输出），返回一个 AIMessage 对象。
// modelWithTools.invoke(messages) 是一个特殊的方法，它不仅会生成模型的回复，还会检测模型是否提出了工具调用（tool calls）。
// 如果模型在回复中提出了工具调用，invoke 方法会将这些工具调用信息（包括工具名称和参数）作为 response.tool_calls 返回，而不是直接给出最终回答。
// 这使得我们可以在外部捕获模型的工具调用请求，执行相应的工具，并将结果反馈给模型，形成一个交互式的 Agent loop。
// 返回的是 AIMessage 对象，包含 content（模型回复内容）和 tool_calls（模型提出的工具调用信息）。如果模型没有提出工具调用，tool_calls 将是 undefined 或空数组。（所以判断：response.tool_calls && response.tool_calls.length > 0）
