#!/usr/bin/env node
import { execSync } from "node:child_process";

/**
 * 虚拟 Bash 执行器
 * 支持的命令类型:
 * - 文件搜索: find, grep, ls, tree
 * - 目录切换: cd, pwd
 * - Git 操作: status, log, diff, branch, add, commit, fetch, pull
 *
 * 安全限制:
 * - 不支持文件读取、写入、删除操作
 * - 所有命令必须来自预定义的安全枚举
 */

// 支持的命令枚举
const ALLOWED_COMMANDS = {
  // 文件搜索
  find: true,
  grep: true,
  ls: true,
  tree: true,

  // 目录操作
  cd: true,
  pwd: true,

  // Git 查询命令
  git: {
    status: true,
    log: true,
    diff: true,
    branch: true,
    show: true,

    // Git 提交命令
    add: true,
    commit: true,

    // Git 远程命令
    fetch: true,
    pull: true,
  },
};

/**
 * 验证命令是否在允许列表中
 */
function validateCommand(command, args = []) {
  const cmd = command.toLowerCase();

  // Git 命令需要特殊处理
  if (cmd === "git") {
    if (args.length === 0) {
      throw new Error("Git 命令需要指定子命令");
    }

    const subCommand = args[0].toLowerCase();
    if (!ALLOWED_COMMANDS.git[subCommand]) {
      throw new Error(`不支持的 git 子命令: ${subCommand}`);
    }
    return true;
  }

  // 检查其他命令
  if (!ALLOWED_COMMANDS[cmd]) {
    throw new Error(`不支持的命令: ${cmd}`);
  }

  return true;
}

/**
 * 执行单个命令
 */
function executeCommand(command, args = []) {
  try {
    // 验证命令
    validateCommand(command, args);

    // 构建完整命令
    const fullCommand = [command, ...args].join(" ");

    // 执行命令
    const output = execSync(fullCommand, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 60000, // 60秒超时
    });

    return {
      success: true,
      command: fullCommand,
      output: output.trim(),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      command: [command, ...args].join(" "),
      output: error.stdout?.toString() || "",
      error: error.stderr?.toString() || error.message,
    };
  }
}

/**
 * 按顺序执行多个命令
 * 如果某个命令失败,立即停止执行后续命令
 */
function executeBatch(commands) {
  const results = [];

  for (const item of commands) {
    const { command, args = [] } = item;

    if (!command) {
      const errorResult = {
        success: false,
        command: "",
        output: "",
        error: "命令不能为空",
      };
      results.push(errorResult);
      // 命令为空视为失败,停止执行
      break;
    }

    const result = executeCommand(command, args);
    results.push(result);

    // 如果命令失败,立即停止执行后续命令
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * 安全执行预定义的 Shell 命令
 * @param {Object} params - 输入参数
 * @param {Array} params.commands - 命令列表
 * @returns {Object} - 执行结果
 */
export default function executeSafeShellCommands({ commands }) {
  // 验证输入
  if (!Array.isArray(commands)) {
    return {
      success: false,
      error: "参数 commands 必须是一个数组",
      results: [],
    };
  }

  if (commands.length === 0) {
    return {
      success: false,
      error: "命令列表不能为空",
      results: [],
    };
  }

  // 执行命令批次
  const results = executeBatch(commands);

  // 统计执行结果
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return {
    success: successCount > 0,
    total: results.length,
    succeeded: successCount,
    failed: failureCount,
    results,
  };
}

// 添加描述信息,帮助 LLM 理解何时调用此 agent
executeSafeShellCommands.description =
  "安全执行预定义的 Shell 命令,包括文件搜索(find/grep/ls/tree)、目录操作(cd/pwd)和 Git 命令(status/log/diff/add/commit/fetch/pull)。" +
  "适用于需要批量执行多个有顺序依赖的安全命令,如果某个命令失败会立即停止执行后续命令。不支持文件读写删除操作。";

// 定义输入 schema
executeSafeShellCommands.input_schema = {
  type: "object",
  required: ["commands"],
  properties: {
    commands: {
      type: "array",
      description: "要执行的命令列表,按顺序执行",
      items: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description:
              "命令名称,必须是支持的命令(find, grep, ls, tree, cd, pwd, git)",
            enum: ["find", "grep", "ls", "tree", "cd", "pwd", "git"],
          },
          args: {
            type: "array",
            description: "命令参数列表",
            items: {
              type: "string",
            },
          },
        },
      },
      minItems: 1,
    },
  },
};

// 定义输出 schema
executeSafeShellCommands.output_schema = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      description: "是否至少有一个命令执行成功",
    },
    total: {
      type: "integer",
      description: "总命令数",
    },
    succeeded: {
      type: "integer",
      description: "成功执行的命令数",
    },
    failed: {
      type: "integer",
      description: "失败的命令数",
    },
    error: {
      type: "string",
      description: "全局错误信息(如果有)",
    },
    results: {
      type: "array",
      description: "每个命令的执行结果",
      items: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "该命令是否执行成功",
          },
          command: {
            type: "string",
            description: "执行的完整命令",
          },
          output: {
            type: "string",
            description: "命令的标准输出",
          },
          error: {
            type: "string",
            description: "错误信息(如果有)",
          },
        },
      },
    },
  },
};
