// Explicit disposable testnet deployment. Encrypted signing material never enters reports or Git.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(resolve(root,'frontend/package.json'));
const {createPublicClient,createWalletClient,http,defineChain,zeroAddress,encodeAbiParameters,parseAbiParameters,keccak256,parseEther}=require('viem');
const {privateKeyToAccount}=require('viem/accounts');
const configurations={
 'arbitrum-sepolia':{id:421614,rpc:'https://sepolia-rollup.arbitrum.io/rpc',explorer:'https://sepolia.arbiscan.io'},
 'robinhood-testnet':{id:46630,rpc:'https://rpc.testnet.chain.robinhood.com',explorer:'https://explorer.testnet.chain.robinhood.com'},
};
const network=process.argv[2],config=configurations[network];
if(!config||process.argv[3]!=='--broadcast-testnet')throw Error('Usage: deploy-multichain.mjs NETWORK --broadcast-testnet');
const keyDirectory=process.env.AWAKENING_KEYSTORE_DIR,passwordFile=process.env.AWAKENING_KEYSTORE_PASSWORD_FILE;
if(!keyDirectory||!passwordFile)throw Error('Encrypted signer configuration required');
const password=readFileSync(passwordFile,'utf8').trim();
let decrypted=execFileSync('cast',['wallet','decrypt-keystore','operator','--keystore-dir',keyDirectory],{env:{...process.env,CAST_UNSAFE_PASSWORD:password},encoding:'utf8',stdio:['ignore','pipe','pipe']});
let secret=decrypted.match(/(?:0x)?[a-fA-F0-9]{64}/)?.[0];
if(!secret)throw Error('Unable to unlock signing account');
const account=privateKeyToAccount(secret.startsWith('0x')?secret:'0x'+secret);secret='';decrypted='';
const chain=defineChain({id:config.id,name:network,nativeCurrency:{name:'Test Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[config.rpc]}},blockExplorers:{default:{name:'Explorer',url:config.explorer}},testnet:true});
const transport=http(config.rpc,{timeout:20000,retryCount:2});
const client=createPublicClient({chain,transport,pollingInterval:500}),wallet=createWalletClient({account,chain,transport});
if(await client.getChainId()!==config.id)throw Error('Wrong RPC network');
if(await client.getBalance({address:account.address})<parseEther('0.002'))throw Error('Need at least 0.002 test ETH for deployment and acceptance');
const output=resolve(root,`contracts/deployments/${network}-${config.id}.json`);
const report=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):{network,chainId:config.id,deploymentDate:new Date().toISOString().slice(0,10),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),script:'contracts/script/deploy-multichain.mjs',compiler:'0.8.34',evmVersion:'cancun',optimizerRuns:800,viaIR:true,deployer:account.address,contracts:{},roles:{custodian:account.address,optionKeeper:account.address,feeSetter:account.address},transactions:[],markets:[],verification:{complete:false}};
if(report.deployer.toLowerCase()!==account.address.toLowerCase()||report.chainId!==config.id)throw Error('Deployment report belongs to another signer/network');
function save(){writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function artifact(name){const a=JSON.parse(readFileSync(resolve(root,`contracts/out-multichain/${name}.sol/${name}.json`),'utf8'));return {...a,bytecode:a.bytecode.object.startsWith('0x')?a.bytecode.object:'0x'+a.bytecode.object};}
async function receipt(hash,label){
 const r=await client.waitForTransactionReceipt({hash,confirmations:1,timeout:120000});
 if(r.status!=='success')throw Error('Transaction reverted: '+label);
 report.firstBlock??=Number(r.blockNumber);report.transactions.push({action:label,hash,block:Number(r.blockNumber),status:r.status});save();console.log(network,label,hash);return r;
}
async function deploy(name,args=[],key=name){
 if(report.contracts[key]){if(!await client.getCode({address:report.contracts[key]}))throw Error('Missing deployed code '+key);return report.contracts[key];}
 const a=artifact(name);const hash=await wallet.deployContract({abi:a.abi,bytecode:a.bytecode,args});const r=await receipt(hash,'deploy '+key);
 report.contracts[key]=r.contractAddress;save();return r.contractAddress;
}
async function read(address,name,fn,args=[]){return client.readContract({address,abi:artifact(name).abi,functionName:fn,args});}
async function call(address,name,fn,args,label=fn){
 if(report.transactions.some(t=>t.action===label))return;
 const {request}=await client.simulateContract({account,address,abi:artifact(name).abi,functionName:fn,args});await receipt(await wallet.writeContract(request),label);
}
const core=await deploy('Awakening');
const vault=await deploy('OptionVault',[core]);
const pat=await deploy('AttestedPAT',[account.address]);
const settlement=await deploy('AwakeningSettlement',[core]);
const ratifier=await deploy('EcrecoverRatifier',[core]);
for(const [fn,value]of [['setOptionKeeper',account.address],['setOptionVault',vault],['setPat',pat],['setSettlement',settlement],['setFeeSetter',account.address]])await call(core,'Awakening',fn,[value]);
const btc=await deploy('TestToken',['Hyperloop Test Bitcoin (NO VALUE)','tBTC',8],'TestBTC');
const usdc=await deploy('TestToken',['Hyperloop Test USDC (NO VALUE)','tUSDC',6],'TestUSDC');
const oracle=await deploy('TestOracle',[account.address,600n*10n**36n]);
const additions=[['TestUSDT','Hyperloop Test USDT','tUSDT',6],['TestTesla','Hyperloop Test bTesla','bTesla',18],['TestNVIDIA','Hyperloop Test bNVIDIA','bNVIDIA',18]];
for(const[key,name,symbol,decimals]of additions)await deploy('TestToken',[name,symbol,decimals],key);
report.contracts.AwakeningLoans=await read(core,'Awakening','AWAKENING_LOANS');
report.testAssets={collateral:{symbol:'tBTC',decimals:8,address:btc},loan:{symbol:'tUSDC',decimals:6,address:usdc},notice:'Permissionless faucet tokens with no monetary value. Protection is simulated; no external option execution.'};
const now=(await client.getBlock()).timestamp;
report.marketMaturities??={normal:String(now+90n*86400n),short:String(now+1200n),acceptance:String(now+240n)};save();
const marketType=parseAbiParameters('(address loanToken,(address token,address oracle)[] collateralParams,uint256 maturity,uint256 maxStrike,uint256 penaltyPct,address enterGate)');
for(const[purpose,maturity]of Object.entries(report.marketMaturities)){
 const market={loanToken:usdc,collateralParams:[{token:btc,oracle}],maturity:BigInt(maturity),maxStrike:400n*10n**36n,penaltyPct:5n*10n**16n,enterGate:zeroAddress};
 const id=await read(core,'Awakening','toId',[market]);
 await call(core,'Awakening','touchMarket',[market],'touchMarket '+purpose);
 if(!report.markets.some(m=>m.id===id))report.markets.push({id,label:'tBTC / tUSDC',purpose:purpose==='normal'?'normal':purpose==='short'?'short-expiry':'acceptance-short-expiry',market:JSON.parse(JSON.stringify(market,(_,v)=>typeof v==='bigint'?v.toString():v))});save();
}
const tokenMetadata=[{key:'TestBTC',symbol:'BTC',onchainSymbol:'tBTC',name:'Bitcoin',decimals:8,logo:'/tokens/btc.svg',marketEnabled:true},{key:'TestUSDC',symbol:'USDC',onchainSymbol:'tUSDC',name:'USDC',decimals:6,logo:'/tokens/usdc.svg',marketEnabled:true},{key:'TestUSDT',symbol:'USDT',onchainSymbol:'tUSDT',name:'USDT',decimals:6,logo:'/tokens/usdt.svg',marketEnabled:false},{key:'TestTesla',symbol:'bTesla',onchainSymbol:'bTesla',name:'bTesla',decimals:18,logo:'/tokens/tesla.svg',marketEnabled:false},{key:'TestNVIDIA',symbol:'bNVIDIA',onchainSymbol:'bNVIDIA',name:'bNVIDIA',decimals:18,logo:'/tokens/nvidia.svg',marketEnabled:false}];
const faucet={chainId:config.id,tokens:[]};
for(const {key,...meta}of tokenMetadata){
 const address=report.contracts[key];
 const decimals=Number(await read(address,'TestToken','decimals')),symbol=await read(address,'TestToken','symbol');
 if(decimals!==meta.decimals||symbol!==meta.onchainSymbol)throw Error('Token metadata mismatch');
 await call(address,'TestToken','faucet',[],'faucet '+key);
 faucet.tokens.push({...meta,address,claimAmount:'1000',claimTx:report.transactions.find(t=>t.action==='faucet '+key).hash});
}
if(Number(await read(core,'Awakening','INITIAL_CHAIN_ID'))!==config.id)throw Error('Core chain mismatch');
for(const[fn,address]of [['optionVault',vault],['pat',pat],['settlement',settlement],['optionKeeper',account.address],['feeSetter',account.address]])if((await read(core,'Awakening',fn)).toLowerCase()!==address.toLowerCase())throw Error('Wrong role/link '+fn);
if((await read(pat,'AttestedPAT','CUSTODIAN')).toLowerCase()!==account.address.toLowerCase())throw Error('Wrong custodian');
report.verification={complete:true,topLevelContractCodePresent:true,rolesAndContractLinksReadBack:true,explorerSourceVerificationCompleted:false,frontendBackendIntegrationCompleted:false,integrationProtection:'SIMULATED_TEST_PROTECTION'};save();
const faucetPath=resolve(root,`contracts/deployments/faucet-${network}-${config.id}.json`);writeFileSync(faucetPath,JSON.stringify(faucet,null,2)+'\n');
const resources=resolve(root,'backend/src/main/resources/contracts');mkdirSync(resources,{recursive:true});writeFileSync(resolve(resources,`${network}-${config.id}.json`),JSON.stringify(report,null,2)+'\n');
console.log('DEPLOYMENT_COMPLETE',network,core);
