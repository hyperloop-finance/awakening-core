# Awakening BNB 测试网部署

日期：2026-10-02。网络：BSC Testnet，Chain ID **97**。

地址、交易哈希、源码提交与编译配置见 [bsc-testnet-97.json](./bsc-testnet-97.json)。

## 已完成

- 使用现有 `script/Deploy.s.sol:Deploy` 部署 Awakening、OptionVault、AttestedPAT、AwakeningSettlement；Awakening 构造器另行部署 AwakeningLoans。
- 9 笔部署/配置交易均取得成功回执。
- RPC 读回确认四个顶层合约有代码，INITIAL_CHAIN_ID 为 97，角色及合约关联与部署配置一致。
- OptionVault、AttestedPAT、TwoStepTake、Settlement 四个测试套件共 46 项通过。
- 实际 gas 支出：**0.0009755965 tBNB**；完成时部署钱包余额：**0.2990244035 tBNB**。
- Awakening 实际链上 runtime 为 21,963 字节。部署脚本中“约 29.4 KB、无法部署”的旧注释已不符合本次构建结果。

## 范围与限制

- 前后端已接入测试网合约，已创建测试市场、测试币、ratifier 和受控测试 oracle；真实链上借贷及结算验收见 [集成验收](./BNB-INTEGRATION-ACCEPTANCE.md)。
- 保护流程仍是人工触发的模拟测试 PAT，未连接 Deribit 或启动自动 keeper。
- 未完成区块浏览器源码验证；链上回执/代码检查不等于源码验证或安全审计。
- 按用户明确授权，roleSetter、feeSetter、optionKeeper、custodian 暂时共用部署钱包。该私钥曾在聊天中披露，此部署只用于可丢弃的测试，不能存入真实资产或直接用于生产。
- 私钥通过交互式无回显输入使用，没有写入项目源文件或创建持久化 keystore；没有提交或推送 Git。
- Foundry 原始回执位于 `broadcast/Deploy.s.sol/97/run-latest.json`（Git 已忽略）。

主合约浏览器地址：

```text
https://testnet.bscscan.com/address/0x99Cc7186E22F6d717FF7692d7e09F8cEd223f3C9
```
