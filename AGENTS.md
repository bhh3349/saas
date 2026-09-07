# 项目级 Agent 指南

## 必读文档

在修改代码前，先按任务范围阅读：

- `餐饮收银SaaS-PRD.md`：产品需求权威来源。
- `开发人员接手指南.md`：架构、启动方式、编码约定和已知坑。
- `收银App开发接手指南.md`：修改 `cashier-app` 前必读。
- `data-table-template.md`：新增或调整 `merchant-web` 表格页时必读。

## 硬约束

- 商家端金额全链路使用「元」，禁止重新引入「分」换算。
- 所有业务表必须带 `shop_id`，查询必须按登录用户的店铺隔离。
- 后端 DTO 使用 `class-validator`；写敏感操作要记录 `operation_logs`。
- `merchant-web` 表格使用统一模板类名；分页使用 `components/Pagination.tsx`。
- 修改业务模型或状态机后，同步更新 PRD 和接手指南。
- SQLite 文件、环境变量文件、部署包和本地安装包不得提交；迁移脚本可以提交。

## 修改后检查

- `merchant-web`：运行 `npx.cmd tsc -b --pretty false`。
- `output/saas-service`：运行 `npm.cmd run typecheck`。
- `output/platform-service`：运行 `npm.cmd run typecheck`。
- 改动 SQLite 金额列语义前，先确认并运行对应数据迁移。

## 上下文优化规则

- 纯 UI / 表格 / 样式任务：只需读 PRD 和 `data-table-template.md`，跳过后端文档。
- 纯后端 API / 数据库任务：只需读开发人员接手指南和 PRD 对应章节，跳过 cashier-app 文档。
- 修改 `cashier-app` 时：读收银App开发接手指南 + PRD，跳过 merchant-web 表格模板。
- 任何任务开始前先看 git status，避免和未提交改动冲突。
- 大型功能拆成小步骤，每步完成后立即跑对应 typecheck，确认通过再继续。
- 不要把临时讨论内容写入 AGENTS.md，只有稳定的规则才写进来。

## Codex 第二大脑

- 项目相关的长期记录放在 `D:\SecondBrain`。
- 三层结构为：`每日筆記/`、`創作庫/`、`知識庫/`。
- 開工時更新每日筆記，收工時寫入當日進度。
