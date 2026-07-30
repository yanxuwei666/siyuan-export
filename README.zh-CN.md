[English](README.md)

# 思源笔记导出

将本地思源工作空间中的所有笔记本导出为 Markdown。

## 功能

* 通过顶栏按钮或命令面板打开导出窗口。
* 保存 Python 命令和导出目录。
* 导出前检查 Python 运行环境。
* 通过思源 API 读取文档，并按笔记本与文档层级生成 Markdown。
* 复制附件到 `assets/`，并重写 Markdown 中的附件链接。
* 在窗口中实时显示导出日志和错误。

## 前置条件

* 思源桌面端 3.7.0 或更高版本。
* 本机已安装 Python 3。Python 环境留空时，macOS 默认使用 `/usr/bin/python3`，Linux 默认使用 `python3`，Windows 默认使用 `py -3`。

## 使用方式

1. 在思源桌面端安装并启用插件。
2. 通过顶栏或命令面板打开“笔记导出”。
3. 填写导出目录。
4. 可选：填写 Python 可执行文件路径或命令。
5. 点击“开始导出”，在日志中查看进度与结果。

插件通过思源 API 读取文档和附件，并将 Markdown 写入所选导出目录。若同一路径已有文件，会被覆盖。

## 开发

```bash
pnpm install
pnpm run dev
```

执行 `pnpm run build` 生成 `package.zip`。安装包包含编译后的插件、翻译文件、元数据、图片、文档和内置 Python 导出器。
