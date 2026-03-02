#!/usr/bin/env node

import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- CLI argument parsing (no third-party deps) ---
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        args[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '';
      }
    }
  }
  return args;
}

// --- Simple Jinja2-like template engine ---
function evalExpr(expr, vars) {
  expr = expr.trim();
  // Handle OR
  if (expr.includes(' or ')) {
    return expr.split(' or ').some((e) => evalExpr(e.trim(), vars));
  }
  // Handle AND
  if (expr.includes(' and ')) {
    return expr.split(' and ').every((e) => evalExpr(e.trim(), vars));
  }
  // Handle equality: var == "value"
  const eqMatch = expr.match(/^(\w+)\s*==\s*"([^"]*)"$/);
  if (eqMatch) return vars[eqMatch[1]] === eqMatch[2];
  // Truthy check
  return Boolean(vars[expr]);
}

function renderTemplate(template, vars) {
  const lines = template.split('\n');
  const result = [];
  const stack = []; // {active, matched}

  for (const line of lines) {
    const trimmed = line.trim();

    // Match Jinja2 tag at start of line, with optional trailing content
    const tagMatch = trimmed.match(/^\{%[-\s]*(if|elif|else|endif)\s*(.*?)[-]?%\}(.*)$/);
    if (tagMatch) {
      const [, keyword, expr, rest] = tagMatch;

      if (keyword === 'if') {
        const parentActive = stack.every((s) => s.active);
        const condResult = parentActive && evalExpr(expr.trim(), vars);
        stack.push({ active: condResult, matched: condResult });
      } else if (keyword === 'elif') {
        const top = stack[stack.length - 1];
        const parentActive = stack.slice(0, -1).every((s) => s.active);
        if (top.matched) {
          top.active = false;
        } else {
          const condResult = parentActive && evalExpr(expr.trim(), vars);
          top.active = condResult;
          if (condResult) top.matched = true;
        }
      } else if (keyword === 'else') {
        const top = stack[stack.length - 1];
        const parentActive = stack.slice(0, -1).every((s) => s.active);
        top.active = parentActive && !top.matched;
        if (top.active) top.matched = true;
      } else if (keyword === 'endif') {
        stack.pop();
      }

      // Include trailing content after the tag if block is active
      if (rest.trim() && stack.every((s) => s.active)) {
        const rendered = rest.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
        result.push(rendered);
      }
      continue;
    }

    // Regular line: include if all conditions in stack are active
    if (stack.every((s) => s.active)) {
      const rendered = line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '');
      result.push(rendered);
    }
  }

  return result.join('\n');
}

// --- MIME type detection ---
function getMimeType(filePath) {
  const ext = filePath.toLowerCase();
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

// --- Save image to disk ---
async function saveImage(imageBuffer, savePath) {
  const outputDir = path.dirname(savePath);
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(savePath, imageBuffer);
  const sizeKB = (imageBuffer.length / 1024).toFixed(1);
  return `图片已保存到 ${savePath}（${sizeKB} KB）`;
}

// --- Extract image buffer from Gemini response ---
function extractImage(response) {
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  return null;
}

// --- Build prompts from template files ---
function buildPrompts(vars) {
  const systemTemplate = readFileSync(path.join(__dirname, 'prompts/system.md'), 'utf-8');
  const userTemplate = readFileSync(path.join(__dirname, 'prompts/user.md'), 'utf-8');
  return {
    system: renderTemplate(systemTemplate, vars),
    user: renderTemplate(userTemplate, vars),
  };
}

// --- Generate mode: text-to-image ---
async function handleGenerate(ai, args) {
  const { desc, savePath, aspectRatio = '4:3', locale = 'zh', documentContent = '' } = args;

  if (!desc) {
    console.error('错误: 缺少 --desc 参数');
    process.exit(1);
  }
  if (!savePath) {
    console.error('错误: 缺少 --savePath 参数');
    process.exit(1);
  }

  const prompts = buildPrompts({
    desc,
    documentContent,
    locale,
    aspectRatio,
    useImageToImage: false,
    existingImage: false,
    feedback: '',
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: prompts.user,
      config: {
        systemInstruction: prompts.system,
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio,
          imageSize: '1K',
        },
      },
    });

    const imageBuffer = extractImage(response);
    if (!imageBuffer) {
      console.error('错误: Gemini 未返回图片数据');
      process.exit(1);
    }

    const message = await saveImage(imageBuffer, savePath);
    console.log(JSON.stringify({ message }));
  } catch (err) {
    console.error(`错误: 生成图片失败 - ${err.message}`);
    process.exit(1);
  }
}

// --- Edit mode: image-to-image ---
async function handleEdit(ai, args) {
  const { desc, sourcePath, savePath, aspectRatio = '4:3', sourceLocale = 'zh' } = args;
  const targetLocale = args.targetLocale || sourceLocale;

  if (!desc) {
    console.error('错误: 缺少 --desc 参数');
    process.exit(1);
  }
  if (!sourcePath) {
    console.error('错误: 缺少 --sourcePath 参数');
    process.exit(1);
  }
  if (!savePath) {
    console.error('错误: 缺少 --savePath 参数');
    process.exit(1);
  }

  // Verify source file exists
  try {
    await fs.access(sourcePath);
  } catch {
    console.error(`错误: 源图片不存在: ${sourcePath}`);
    process.exit(1);
  }

  // Read and encode source image
  const sourceBuffer = await fs.readFile(sourcePath);
  const imageBase64 = sourceBuffer.toString('base64');
  const mimeType = getMimeType(sourcePath);

  // Build edit description (enhance for translation scenario)
  let editDesc = desc;
  if (targetLocale && targetLocale !== sourceLocale) {
    editDesc = `将图片中的文字从 ${sourceLocale} 翻译成 ${targetLocale}。${desc}`;
  }
  const locale = targetLocale || sourceLocale;

  const prompts = buildPrompts({
    desc: editDesc,
    documentContent: '',
    locale,
    aspectRatio,
    useImageToImage: true,
    existingImage: true,
    feedback: desc,
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ inlineData: { mimeType, data: imageBase64 } }, prompts.user],
      config: {
        systemInstruction: prompts.system,
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio,
          imageSize: '1K',
        },
      },
    });

    const resultBuffer = extractImage(response);
    if (!resultBuffer) {
      console.error('错误: Gemini 未返回图片数据');
      process.exit(1);
    }

    const message = await saveImage(resultBuffer, savePath);
    console.log(JSON.stringify({ message }));
  } catch (err) {
    console.error(`错误: 编辑图片失败 - ${err.message}`);
    process.exit(1);
  }
}

// --- Main entry point ---
async function main() {
  const args = parseArgs(process.argv);

  if (!args.mode || !['generate', 'edit'].includes(args.mode)) {
    console.error('错误: 请指定 --mode=generate 或 --mode=edit');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('错误: GEMINI_API_KEY 未配置。请设置环境变量后重试。');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  if (args.mode === 'generate') {
    await handleGenerate(ai, args);
  } else {
    await handleEdit(ai, args);
  }
}

main();
