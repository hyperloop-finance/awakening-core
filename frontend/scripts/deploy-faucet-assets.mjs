// Disposable BNB Testnet only. Secret input stays in memory and is never logged.
import {createPublicClient,createWalletClient,http,parseEther,encodeDeployData} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deployment} from '../src/lib/contracts/generated.ts';

if(process.argv[2] !== '--broadcast-testnet') throw Error('Requires --broadcast-testnet');
const rpc='https://bsc-testnet-rpc.publicnode.com';
const client=createPublicClient({chain:bscTestnet,transport:http(rpc),pollingInterval:1200});
if(await client.getChainId()!==97) throw Error('Wrong chain');
const contracts=resolve(dirname(fileURLToPath(import.meta.url)),'../../contracts');
const artifact=JSON.parse(readFileSync(resolve(contracts,'out/TestToken.sol/TestToken.json'),'utf8'));
const output=resolve(contracts,'deployments/faucet-bsc-testnet-97.json');
const report=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):{chainId:97,tokens:[
  {symbol:'BTC',onchainSymbol:'tBTC',name:'Bitcoin',decimals:8,address:deployment.contracts.TestBTC,logo:'/tokens/btc.svg',marketEnabled:true},
  {symbol:'USDC',onchainSymbol:'tUSDC',name:'USDC',decimals:6,address:deployment.contracts.TestUSDC,logo:'/tokens/usdc.svg',marketEnabled:true},
]};
function save(){writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function secret(){
  if(!process.stdin.isTTY)throw Error('Interactive terminal required');
  process.stdout.write('Testnet signing key (hidden, memory only): ');
  process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value='';const handler=chunk=>{for(const ch of chunk.toString()){
    if(ch==='\u0003'){finish();reject(Error('Cancelled'));return;}
    if(ch==='\r'||ch==='\n'){finish();resolve(value);return;}
    if(ch==='\u007f'){value=value.slice(0,-1);continue;}
    if(/[a-fA-F0-9x]/.test(ch))value+=ch;
  }};function finish(){process.stdin.removeListener('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',handler);});
}
let value=await secret();
const account=privateKeyToAccount(value.startsWith('0x')?value:'0x'+value);value='';
if(account.address.toLowerCase()!==deployment.deployer.toLowerCase())throw Error('Wrong disposable test operator');
const wallet=createWalletClient({account,chain:bscTestnet,transport:http(rpc)});
const additions=[
  {symbol:'USDT',onchainSymbol:'tUSDT',name:'USDT',decimals:6,logo:'/tokens/usdt.svg',marketEnabled:false},
  {symbol:'bTesla',onchainSymbol:'bTesla',name:'bTesla',decimals:18,logo:'/tokens/tesla.svg',marketEnabled:false},
  {symbol:'bNVIDIA',onchainSymbol:'bNVIDIA',name:'bNVIDIA',decimals:18,logo:'/tokens/nvidia.svg',marketEnabled:false},
];
for(const token of additions){
  if(report.tokens.some(t=>t.symbol===token.symbol))continue;
  const args=[`Hyperloop Test ${token.name}`,token.onchainSymbol,token.decimals];
  const data=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode.object,args});
  const gas=await client.estimateGas({account,data});const gasPrice=await client.getGasPrice();
  if(gas*gasPrice>parseEther('0.001'))throw Error('Gas budget exceeded');
  const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode.object,args,gas:gas*12n/10n,gasPrice});
  console.log('Submitted',token.symbol,hash);
  const receipt=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:120000});
  if(receipt.status!=='success'||!receipt.contractAddress)throw Error('Deployment failed');
  report.tokens.push({...token,address:receipt.contractAddress,deploymentTx:hash});save();
}
for(const token of report.tokens){
  const address=token.address;
  const [code,symbol,decimals]=await Promise.all([client.getCode({address}),client.readContract({address,abi:artifact.abi,functionName:'symbol'}),client.readContract({address,abi:artifact.abi,functionName:'decimals'})]);
  if(!code||code==='0x'||symbol!==token.onchainSymbol||decimals!==token.decimals)throw Error(`Metadata mismatch: ${token.symbol}`);
  if(token.claimTx)continue;
  const balance=()=>client.readContract({address,abi:artifact.abi,functionName:'balanceOf',args:[account.address]});
  const before=await balance();
  const {request}=await client.simulateContract({account,address,abi:artifact.abi,functionName:'faucet'});
  const hash=await wallet.writeContract(request);
  const receipt=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:120000});
  if(receipt.status!=='success'||await balance()-before!==1000n*10n**BigInt(token.decimals))throw Error('Claim balance mismatch');
  token.claimTx=hash;token.claimAmount='1000';save();console.log('Verified faucet',token.symbol,hash);
}
report.verifiedAt=new Date().toISOString();save();
writeFileSync(resolve('src/lib/contracts/faucet-deployment.json'),JSON.stringify(report,null,2)+'\n');
console.log('Verified five faucet assets; exported public frontend manifest.');
