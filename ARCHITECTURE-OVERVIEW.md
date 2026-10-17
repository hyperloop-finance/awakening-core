# Awakening 架构与目录

更新：2026-10-17。前端、后端、合约已统一在 Awakening 主目录，日常开发不再依赖 worktree。

## 目录

```text
Awakening/
├── frontend/       Next.js 页面、钱包签名、合约 ABI 与前端测试
├── backend/        Spring Boot API、事件索引、签名订单与后端测试
├── contracts/      Solidity、Foundry 测试、部署脚本和公开测试网地址
├── docs/api/       mock 产品接口及真实测试网接口契约
├── ops/            基础设施配置
└── .local-runtime/ 本机报告、备份与检查截图，不提交 Git
```

## 三者如何连接

```text
浏览器 → 后端 API → PostgreSQL 索引 + BNB Testnet RPC
浏览器 → MetaMask / Rabby → BNB Testnet 合约交易
测试运营者 → completeTake → 模拟 PAT 保护完成 → 借贷生效
```

后端不保存用户私钥，也不代替用户签署交易。前端通过钱包签名、精确授权、模拟交易和回执确认操作链上资产。后端从事件和合约读数重建账户视图，保留 12 个确认区块，因此交易成功后 UI 可能短暂滞后。

## 前端

- `src/app/`：页面路由、全局样式与 Provider。
- `src/components/shell/`：导航、真实钱包、网络选择、运行配置和账户隔离。
- `src/components/chain/chain-markets.tsx`：真实测试网 Markets。
- `src/components/chain/chain-workspace.tsx`：签单、撤单、成交、还款及领取的交易逻辑。
- `src/components/chain/account-workspace.tsx`：Orders、Positions、Settlement 页面布局。
- `src/components/chain/faucet-screen.tsx`：领取测试币与添加代币到钱包。
- `src/components/chain/use-chain-wallet.ts`：网络、部署、地址、授权、签名和交易边界检查。
- `src/lib/api/chain.ts`：真实链 API 客户端。
- `src/lib/contracts/`：公开部署清单、ABI、签名订单编码及金额校验。

旧 mock 页面与接口保留为独立预览模式，不代表真实链上余额。真实 profile 不混用这些数据。

## 后端

Java 21 / Spring Boot / PostgreSQL。主要包位于 `backend/src/main/java/xyz/hyperloop/awakening/`。

- `config/`：profile、CORS 和交易启用状态。
- `chain/DeploymentVerifier`：验证实际网络、部署地址、关联与权限。
- `chain/ChainEventIndexer`、`ChainReadRepository`：事件、确认区块与持久化游标。
- `chain/ChainProjectionService`：市场、仓位、贷款和待处理成交的读模型。
- `chain/ChainOrderService`：EIP-712 签名订单校验、存储和链上报价检查。
- `src/main/resources/db/migration/`：数据库结构迁移。
- `src/main/resources/contracts/`：供后端读取的公开 ABI 和部署清单。

签名订单保存在本地数据库，仓位和余额以链上合约为准。链上索引可重建，尚未成交的链下签单不能仅靠链事件重建。

## 合约

- Awakening：市场、credit/debt、成交、抵押与提现。
- AwakeningLoans：贷款生命周期。
- OptionVault / AttestedPAT：测试保护持仓与归属。
- AwakeningSettlement：还款、到期结算与保护收益记录。
- EcrecoverRatifier：订单签名授权与取消。
- TestToken / TestOracle：无价值测试代币及受控价格源。

当前只接入 BNB Testnet（97）。PAT 为模拟测试保护，未执行真实 Deribit 期权采购，也没有自动 keeper。不能将此部署用于真实资金；已知旧仓位收益领取边界见 `contracts/TESTNET-ACCOUNT-SEED-NOTES.md`。

## 页面与操作

| 页面 | 作用 |
| --- | --- |
| Markets | 浏览固定到期市场，获取真实可执行订单报价，Borrow / Lend |
| Orders | 按自己的条件签单、查看签单历史、链上撤单 |
| Positions | 查看借款、出借余额、抵押及 PAT |
| Settlement | 偿还债务、领取可用出借款及符合条件的抵押/保护收益 |
| Faucet | 领取五种测试币；目前仅 BTC / USDC 有借贷市场 |

## 本地开发

启动、环境配置、数据库位置和测试命令见 [LOCAL-BSC-TESTNET.md](LOCAL-BSC-TESTNET.md)。正常开发只打开本目录中的 `frontend/`、`backend/`、`contracts/`。提交按功能分组，原有开发提交不压缩；本地运行资料不上传。
