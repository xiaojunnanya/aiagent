import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 数据库
const database = {
  users: {
    "001": {
      id: "001",
      name: "张三",
      email: "zhangsan@example.com",
      role: "admin",
    },
    "002": { id: "002", name: "李四", email: "lisi@example.com", role: "user" },
    "003": {
      id: "003",
      name: "王五",
      email: "wangwu@example.com",
      role: "user",
    },
  },
};

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
});

// 注册Tool，类似于函数，可以被 MCP Client 调用
server.registerTool(
  "query_user", // Tool name
  {
    description:
      "查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。",
    // Tool input schema
    inputSchema: {
      userId: z.string().describe("用户 ID，例如: 001, 002, 003"),
    },
  },
  // Tool 实现函数
  // 当 ai 调用工具时，会执行这个函数，把参数传进来，结果返回给 AI
  async ({ userId }) => {
    const user = database.users[userId];

    if (!user) {
      // 注意返回内容格式：
      // {
      //   content: [
      //     {
      //       type: "text",
      //       text: "用户信息",
      //     },
      //   ],
      // }
      // 这是 MCP 标准格式。


      return {
        content: [
          {
            type: "text",
            text: `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`,
        },
      ],
    };
  }
);

// 注册 Resource（资源），类似于文件，可以被 MCP Client 读取
server.registerResource(
  "使用指南", // Resource name
  "docs://guide", // Resource uri
  {
    description: "MCP Server 使用文档",
    mimeType: "text/plain",
  },
  async () => {
    return {
      contents: [
        {
          uri: "docs://guide",
          mimeType: "text/plain",
          text: `MCP Server 使用指南

功能：提供用户查询等工具。

使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具。`,
        },
      ],
    };
  }
);

// 启动 MCP Server，并通过 stdio 等待 Client 连接
const transport = new StdioServerTransport();
await server.connect(transport);
