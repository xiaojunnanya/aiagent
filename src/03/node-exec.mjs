import { spawn } from "node:child_process";
// ls -la 命令的意思：以详细格式列出当前目录 所有文件（包括隐藏文件）
// 平常我们直接 ls 是看不到隐藏文件的
const command = "ls -la";
const cwd = process.cwd();

// 解析命令和参数
const [cmd, ...args] = command.split(" ");

const child = spawn(cmd, args, {
  cwd,
  stdio: "inherit", // 实时输出到控制台
  shell: true,
});

let errorMsg = "";

child.on("error", (error) => {
  errorMsg = error.message;
});

child.on("close", (code) => {
  if (code === 0) {
    process.exit(0);
  } else {
    if (errorMsg) {
      console.error(`错误: ${errorMsg}`);
    }
    process.exit(code || 1);
  }
});
