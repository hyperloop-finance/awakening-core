# Awakening 本地 BNB 测试网

## 打开

前端：`http://127.0.0.1:3000/markets`

后端状态：`http://127.0.0.1:8082/api/v1/config`

仅 chain ID 97。没有主网资产、Deribit 实盘期权或自动做市。测试币和 PAT 都明确标为测试用途。

## 如何测试

1. 用 MetaMask / Rabby 等浏览器钱包连接 BNB Testnet，需要少量测试 BNB 支付 gas。没有 WalletConnect project ID 时不显示不能工作的二维码入口。
2. 在 Faucet 领取测试币；在 Orders 选择市场和 Borrow / Lend 方向，完成精确额度授权、ratifier 授权和 EIP-712 签单。
3. 用另一个钱包在 Markets 选择相反方向，获取报价后成交。不能接受自己的订单；无有效订单时不伪造流动性。
4. takeInit 之后先显示 pending escrow。测试运营者必须人工完成测试保护，才会变为生效贷款；没有自动 Deribit 采购。
5. Positions 查看链上索引余额；Settlement 可部分/全部还款、领取可用的出借余额、抵押品及剩余收益。交易回执后索引保留 12 个确认区块，必要时点击 Refresh chain data。

验收历史订单已经使用或取消，不是永远有效的演示报价。普通钱包页面没有 oracle / keeper 操作权限。

## 代码位置

- `frontend/`：页面、真实钱包操作、可信 ABI / Market 校验。
- `backend/`：`bsc-testnet` profile、持久化签名订单、事件索引与真实报价。
- `contracts/deployments/bsc-testnet-97.json`：公开地址和市场元组。
- `contracts/script/TestnetOperator.s.sol`：人工测试保护完成脚本，交互签名；不要在命令行或源码填私钥。
- `docs/api/bsc-chain.openapi.json`：真实链 API 契约；旧 `openapi.yaml` 是 mock 产品 API，bsc-testnet profile 不开放旧 mock 控制器。
- `contracts/deployments/BNB-INTEGRATION-ACCEPTANCE.md`：验收范围、限制及公开交易记录。

## 重启

后端在主目录的 `backend/` 运行（Docker Desktop 需已启动，JDK 21）：

```sh
docker compose -p awakening-bsc-testnet -f compose.bsc-testnet.yml up -d
AWAKENING_DATABASE_PASSWORD=awakening-local-test-only ./mvnw -Dmaven.repo.local=target/m2 spring-boot:run -Dspring-boot.run.profiles=bsc-testnet -Dspring-boot.run.arguments='--server.port=8082 --awakening.transactions-enabled=true'
```

前端在主目录的 `frontend/` 运行（Node.js 22+、pnpm；操作脚本使用 Node.js 22.18+ 的 TypeScript 支持）：

```sh
cp .env.local.example .env.local
pnpm install --frozen-lockfile
pnpm build
pnpm start --hostname 127.0.0.1 --port 3000
```

前端 `.env.local` 仅含公开 API/RPC 地址及 profile，没有私钥。修改源码后需先停止现有前端，再 `pnpm build`、`pnpm start`，不要让 build 和 dev 共用正在写入的 `.next`。

所有数据都在 Awakening 内；服务只监听 localhost。数据库位于 `backend/.runtime/bsc-postgres`，不要删除或重复初始化。新克隆会从链上重建索引，但不会拥有仅存于原本地数据库的签名订单。

已暴露的运营者密钥只能用于可丢弃测试部署，不能使用真实资金。`.env.local`、数据库、原始广播日志及 `.local-runtime/` 不上传 GitHub。

## 验证与限制

在 `frontend/` 执行 `pnpm test`、`pnpm lint`、`pnpm build`；在 `backend/` 执行 `./mvnw -Dmaven.repo.local=target/m2 test`；在 `contracts/` 执行 `forge test`。数据库专项测试需显式设置 `BSC_DB_TESTS=true` 并启动测试数据库。

`frontend/scripts/` 的链上操作脚本均要求显式 `--broadcast-testnet` 和交互式密钥输入。不要为检查 UI 重跑播种脚本。当前可操作测试仓位与已知合约边界见 `contracts/TESTNET-ACCOUNT-SEED-NOTES.md`。
