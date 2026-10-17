# BNB 测试网集成验收

日期：2026-10-02。仅 chain ID 97，无真实资产。

## 已验证

- 两个独立测试账户：借款人 0xA6fB41371B8Ea239ae4F4E71F2037BeC66ebCDb8；出借人 0xB7269fE04Bc11B883a99E3C537FE97fe1Db25513。
- 真实 EIP-712 签名、幂等订单保存、链上验签和整数报价。
- Borrow / Lend 两种 maker 方向均完成 takeInit 和测试保护完成。
- 后端显示待成交托管，完成后才显示债务；订单重启后仍保留。
- 部分还款 25 tUSDC、全部偿还剩余 75 tUSDC、退回抵押品、出借人领取、剩余收益领取。
- 链上撤单、keeper 取消待成交交易、等待真实测试网到期后结算并领取。
- 本次成功验收 34 笔交易；全部公开回执和 actor 见 bsc-integration-receipts.json。

## 使用

验证结果：前端 79 项测试、后端 61 项（含实际 PostgreSQL）、合约 78 项通过；前端 lint、类型检查和 production build 通过。四个页面 HTTP 200，独立浏览器桌面/手机布局无横向溢出、无页面异常；受控 EIP-1193 适配器验证连接、拒绝交易、断开，未广播交易。原生钱包扩展签名尚未验证。

前端：http://127.0.0.1:3000/markets
后端：http://127.0.0.1:8082/api/v1/config

连接 BNB Testnet 钱包，在 Orders 领取无价值测试币并创建订单。用另一个钱包在 Markets 获取报价、授权并成交。没有有效对手单时不生成假报价。Positions 区分 pending escrow 和 active loan；Settlement 提供还款、可用余额领取及剩余收益。

completeTake 需要测试运营者人工执行 contracts/script/TestnetOperator.s.sol，不向普通用户开放 keeper 权限，也不会自动采购期权。运行时需交互签名；私钥不放在代码、环境文件或命令行。

## 限制与未验收项

- PAT 是 SIMULATED_TEST_PROTECTION；没有 Deribit 实盘或测试环境成交凭据。测试 oracle / proceeds 不代表外部市场执行。
- 普通用户超时 cancelTake 的权限与时间边界通过合约测试，本次 BSC 回执是 keeper 主动取消。
- 本次链上验收使用脚本内存签名账户，不代表浏览器钱包扩展端到端点击已验证；浏览器检查和钱包身份切换单元测试分别记录。
- 无自动做市或保证流动性。历史验收订单已用完或撤销，新测试需要有效对手订单。
- 没有区块浏览器源码验证、核心合约安全审计或主网就绪承诺。暴露过的测试运营者地址不得使用真实资金。
- 订单列表暂最多返回 100 条历史签名；索引提示暂不自动从 indexing 切换到最终完成，数据可手动刷新。
- 首次验收因未导出 EventsLib ABI 在已成功 takeInit 后中断，记录保留于 .local-runtime/bsc-acceptance.json；未将这次中断误记为完整通过。其无价值测试托管可由 keeper 取消。

## 成功回执

| 操作 | 区块 | 交易 | 状态 |
| --- | --- | --- | --- |
| Fund ephemeral test wallet | 134547364 | [0xec6a991535…](https://testnet.bscscan.com/tx/0xec6a991535e059e5fcfc430ddbe4472dd507ccfc9c655c402904af65a3f1bf1c) | success |
| Fund ephemeral test wallet | 134547372 | [0x2814884860…](https://testnet.bscscan.com/tx/0x281488486006fc362bfcdcd38d15b64f1b6308adde199925ee5c8c84675c3555) | success |
| Mint valueless test USDC | 134547379 | [0x0d7ce64419…](https://testnet.bscscan.com/tx/0x0d7ce64419cf707c10af4de17a6e828be2d4fd1f7b79da257ee557be51aabf3e) | success |
| Mint valueless test USDC | 134547386 | [0x5d98f751c8…](https://testnet.bscscan.com/tx/0x5d98f751c8da64d443246455487c9dfd26273cd0bfa81ac1fc48e046c6741941) | success |
| Mint valueless test USDC | 134547392 | [0x454d766422…](https://testnet.bscscan.com/tx/0x454d7664221f13f1ec1c80af1e488257c82d22a7ed22a21e589cf610ce9ae378) | success |
| Mint valueless test BTC | 134547399 | [0xb4f91752f1…](https://testnet.bscscan.com/tx/0xb4f91752f16bfe5005d951e054ecfd09e943020d40862748e949a9642390d0b8) | success |
| approve | 134547408 | [0x4f88ac792f…](https://testnet.bscscan.com/tx/0x4f88ac792f0ed7c623f82b0945ec1b752de4c4651d26f05c87aee2431a4434f8) | success |
| approve | 134547413 | [0x7a1e5f8086…](https://testnet.bscscan.com/tx/0x7a1e5f80863fccf7643bfe03914badc3f50a29ed9fbd11465e28c2a9101f0588) | success |
| setIsAuthorized | 134547420 | [0xc147a6967c…](https://testnet.bscscan.com/tx/0xc147a6967c6b73eb795d35331126bcebb37cbdeb99cba197f047ffc712737272) | success |
| Borrow against lender signed offer | 134547446 | [0x84181c18ae…](https://testnet.bscscan.com/tx/0x84181c18aeb28c0f4232d7870398557c6e2b6b0ba084fb34a0fb39af85c5d560) | success |
| Complete simulated test protection | 134547503 | [0x316236002c…](https://testnet.bscscan.com/tx/0x316236002c09313232b43bd2c19ac151f46a25a14e9e3753df4a2cf691fcf940) | success |
| approve | 134547566 | [0x36e1966d88…](https://testnet.bscscan.com/tx/0x36e1966d88f8ebd89a4e4cdd85f8b8b616fa4ab2d81a8e34c05ac6fcf5964c81) | success |
| Partial repay through settlement | 134547573 | [0x1b862c135b…](https://testnet.bscscan.com/tx/0x1b862c135b0f3325e27d00f7d9a5dabfac05463c7c048933bc6f0ee3fb4cac8b) | success |
| Full repayment | 134547581 | [0xbf84a9dc89…](https://testnet.bscscan.com/tx/0xbf84a9dc8903e1d72c891366a18d4f23ae9c7cad8927f41164d3f04f6c50a8d2) | success |
| Claim lender payout | 134547588 | [0xd3a4b4187b…](https://testnet.bscscan.com/tx/0xd3a4b4187b542f3899277ffb4e7cc05141a5eca474334e4fde7e605ff98f5fe3) | success |
| approve | 134547595 | [0xfcf0a0b961…](https://testnet.bscscan.com/tx/0xfcf0a0b9612977ee8e3a05612ac7dd5906aaeb79f3b04beaa204bc03d0f2fbfd) | success |
| Report simulated put resale | 134547601 | [0xb0eda745f0…](https://testnet.bscscan.com/tx/0xb0eda745f06698b5fd94160f1c24570aa3b2652372505d00e139b108e2b98f83) | success |
| Claim residual proceeds | 134547608 | [0xf40ddaea53…](https://testnet.bscscan.com/tx/0xf40ddaea53319321ff6190f5d43935d5f56aa417b6d948a38e9527edb1f97de1) | success |
| Cancel signed order on-chain | 134547615 | [0x693d6c3031…](https://testnet.bscscan.com/tx/0x693d6c30315c94f3258a9687e6a7356359ccb067a6668504619091decfdd9122) | success |
| approve | 134547624 | [0x7eb5ef1ae8…](https://testnet.bscscan.com/tx/0x7eb5ef1ae88006415388d74beaff551102a66d7a8ae21e9031757c1d27c330df) | success |
| approve | 134547630 | [0xf539fd6be9…](https://testnet.bscscan.com/tx/0xf539fd6be9a53c74d8c19b472ef5cbac0b3a91450744c63f93a1a3bdc7ae3da4) | success |
| takeInit | 134547637 | [0x345e60e4f7…](https://testnet.bscscan.com/tx/0x345e60e4f7aadbd00edcaa84d1a4f55578aec9504d89191cf5f58522b079c8fc) | success |
| Refund pending escrow | 134547644 | [0xfc3ad1ddde…](https://testnet.bscscan.com/tx/0xfc3ad1ddde0385a3dbfd6451eca1999c5d38503ad3172a55135733ca0265aba9) | success |
| Create short-maturity acceptance market | 134547651 | [0x2974fe6730…](https://testnet.bscscan.com/tx/0x2974fe6730dd579c71a37bac991f1fe27c93778cd56acd936d083339f661418d) | success |
| setIsAuthorized | 134547659 | [0x47c70e56b3…](https://testnet.bscscan.com/tx/0x47c70e56b31de6e8c8102f6cbba44e305cc265bb819ae9fd53da126c078c3cf7) | success |
| approve | 134547667 | [0x308cdeba53…](https://testnet.bscscan.com/tx/0x308cdeba53b3d96784ad8cfdcfd32481f02b5c2e15fb97059af60d51097110f5) | success |
| approve | 134547674 | [0x59fa7d57f6…](https://testnet.bscscan.com/tx/0x59fa7d57f66b84226569e0c8418f7bac39e703bb260b72a4d56476e7a8f8aab8) | success |
| Lend against borrower signed offer | 134547681 | [0x74bdd6de22…](https://testnet.bscscan.com/tx/0x74bdd6de2254b2bf1817aa7e314e2f376bdaa81278f9ce20e3f71beaca4ad1fa) | success |
| Complete simulated test protection | 134547696 | [0x1bdde95bcd…](https://testnet.bscscan.com/tx/0x1bdde95bcd3a10e90b228678ca5c410ea8e72576de9345ad826dfeb48ad2afce) | success |
| readOracleAtMaturity | 134548064 | [0x441a9267b2…](https://testnet.bscscan.com/tx/0x441a9267b251f7494cb8808beb0de91d7e2a357e222da9c63c787194200e693b) | success |
| redeemPATs | 134548073 | [0x6529b6c049…](https://testnet.bscscan.com/tx/0x6529b6c049b9d4a0bbd1a6a02b07e4fd83b10b77835bf2e09df0042ae4d03894) | success |
| approve | 134548079 | [0xa1b169b9b7…](https://testnet.bscscan.com/tx/0xa1b169b9b7dc6e9cbfdc9449a7980281ad930e8a94ec6dbd331a0c2a13202925) | success |
| Settle matured test loan with simulated proceeds | 134548086 | [0x2d610c0373…](https://testnet.bscscan.com/tx/0x2d610c03739163778fafb2173a0c1e395238c31bccda7cb388ff1300961aa8b0) | success |
| Claim matured lender payout | 134548092 | [0x63af56bba5…](https://testnet.bscscan.com/tx/0x63af56bba52289bc2cf4bb21486032f701390a3d5c1c8594d8a9f16da4c2000a) | success |
