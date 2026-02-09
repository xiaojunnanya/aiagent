import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

/** ---------- MCP CLIENT ---------- */
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "node",
      args: ["C:\\X\\program\\study\\ai\\src\\4\\my-mcp-server.mjs"],
    },
  },
});

/** ---------- LOAD TOOLS ---------- */
const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

/** ---------- 读取 MCP Resource 并注入上下文 ---------- */
async function loadResourceContext() {
  const res = await mcpClient.listResources();

  let resourceContent = "";
  for (const [serverName, resources] of Object.entries(res)) {
    for (const resource of resources) {
      const content = await mcpClient.readResource(
        serverName,
        resource.uri
      );
      resourceContent += content[0].text + "\n";
    }
  }
  return resourceContent;
}

/** ---------- AGENT LOOP ---------- */
async function runAgentWithTools(query, resourceContext, maxIterations = 30) {
  const messages = [
    new SystemMessage(resourceContext), // 注入 resource 作为上下文
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));

    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(
      chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`)
    );
    console.log(
      chalk.bgBlue(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`
      )
    );

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          })
        );
      }
    }
  }

  return messages[messages.length - 1].content;
}

/** ---------- RUN ---------- */
try {
  const resourceContext = await loadResourceContext();

  await runAgentWithTools(
    "MCP Server 的使用指南是什么",
    resourceContext
  );

  await runAgentWithTools(
    "查一下用户 002 的信息",
    resourceContext
  );
} finally {
  await mcpClient.close();
}
