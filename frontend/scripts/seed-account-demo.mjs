// Explicit disposable-testnet acceptance harness. No keys are written or printed.
import {createPublicClient,createWalletClient,http,encodeAbiParameters,parseAbiParameters,keccak256,concat,parseSignature,decodeEventLog,zeroAddress,toHex} from 'viem';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deployment,awakeningAbi,awakeningSettlementAbi,attestedPATAbi,testTokenAbi,eventsLibAbi} from '../src/lib/contracts/generated.ts';
import {hashOffer,offerTypedData,ratifierData} from '../src/lib/contracts/offer-tree.ts';

if(process.argv[2]!=='--broadcast-testnet')throw Error('Explicit --broadcast-testnet is required');
const client=createPublicClient({chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com',{timeout:15000,retryCount:2}),pollingInterval:1200});
if(await client.getChainId()!==97)throw Error('Wrong RPC chain');
const addresses=deployment.contracts,core=addresses.Awakening,api='http://127.0.0.1:8082/api/v1/chain';
const report={chainId:97,startedAt:new Date().toISOString(),protection:'SIMULATED_TEST_PROTECTION',transactions:[],checks:[],complete:false};
const reports=resolve(dirname(fileURLToPath(import.meta.url)),'../../.local-runtime');
const output=resolve(reports,`account-seed-${Date.now()}.json`);
function save(){mkdirSync(reports,{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function check(ok,label){if(!ok)throw Error(label);report.checks.push(label);save();console.log('PASS',label);}
function secret(){
  if(!process.stdin.isTTY)throw Error('Interactive terminal required');
  process.stdout.write('Test operator private key (hidden, memory only): ');
  process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value='';const handler=chunk=>{for(const ch of chunk.toString()){
    if(ch==='\u0003'){finish();reject(Error('Cancelled'));return;}
    if(ch==='\r'||ch==='\n'){finish();resolve(value);return;}
    if(ch==='\u007f'){value=value.slice(0,-1);continue;}
    if(/[a-fA-F0-9x]/.test(ch))value+=ch;
  }};function finish(){process.stdin.removeListener('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',handler);});
}
let secretValue=await secret();if(!secretValue.startsWith('0x'))secretValue='0x'+secretValue;
const operator=privateKeyToAccount(secretValue);secretValue='';
check(operator.address.toLowerCase()===deployment.deployer.toLowerCase(),'Disposable operator identity');
const lender=privateKeyToAccount(generatePrivateKey()),borrower=privateKeyToAccount(generatePrivateKey());
report.actors={operator:operator.address,lender:lender.address,borrower:borrower.address};save();
const wallet=account=>createWalletClient({account,chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com',{timeout:15000,retryCount:1})});
async function read(address,abi,functionName,args=[]){return client.readContract({address,abi,functionName,args});}
async function tx(account,address,abi,functionName,args=[],label=functionName){
  const {request}=await client.simulateContract({account,address,abi,functionName,args});
  const hash=await wallet(account).writeContract(request);
  const receipt=await client.waitForTransactionReceipt({hash,confirmations:2,timeout:120000});
  report.transactions.push({label,actor:account.address,to:address,hash,block:Number(receipt.blockNumber),status:receipt.status});save();
  check(receipt.status==='success',label);return receipt;
}
async function fund(account){
  const hash=await wallet(operator).sendTransaction({to:account.address,value:3000000000000000n});
  const r=await client.waitForTransactionReceipt({hash,confirmations:2});
  report.transactions.push({label:'Fund ephemeral test wallet',actor:operator.address,to:account.address,hash,block:Number(r.blockNumber),status:r.status});save();check(r.status==='success','Test gas funding');
}
async function request(path,body){
  const response=await fetch(api+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body,(_,v)=>typeof v==='bigint'?v.toString():v)}:undefined);
  const data=await response.json();if(!response.ok)throw Error(`API ${response.status}: ${data.detail??data.message??'unavailable'}`);return data;
}
function marketOf(m){return {...m,collateralParams:m.collateralParams.map(c=>({...c})),maturity:BigInt(m.maturity),maxStrike:BigInt(m.maxStrike),penaltyPct:BigInt(m.penaltyPct)};}
const market=marketOf(deployment.markets[0].market),marketId=deployment.markets[0].id,units=500000000n,collateral=1250000n;
async function signedOffer(m,buy,maker,size=units){
  const now=(await client.getBlock()).timestamp;
  const offer={market:m,buy,maker:maker.address,start:now-30n,expiry:now+3600n<m.maturity?now+3600n:m.maturity-1n,tick:4000n,group:toHex(crypto.getRandomValues(new Uint8Array(32))),callback:zeroAddress,callbackData:'0x',receiverIfMakerIsSeller:maker.address,ratifier:addresses.EcrecoverRatifier,reduceOnly:false,maxUnits:size,maxAssets:0n};
  const signature=await maker.signTypedData(offerTypedData(offer));return {offer,signature,root:hashOffer(offer),data:ratifierData(offer,signature)};
}
function pendingId(receipt){
  for(const log of receipt.logs){try{const event=decodeEventLog({abi:eventsLibAbi,data:log.data,topics:log.topics});if(event.eventName==='TakeInitiated')return event.args.pendingId;}catch{}}
  throw Error('TakeInitiated event missing');
}
async function complete(id){
  const p=await read(core,awakeningAbi,'pendingTakes',[id]);
  const tradeId=keccak256(toHex(`SIMULATED_TEST_PROTECTION:${id}:${Date.now()}`));
  const typehash=await read(addresses.AttestedPAT,attestedPATAbi,'OPTION_TERMS_TYPEHASH');
  const domain=await read(addresses.AttestedPAT,attestedPATAbi,'CUSTODIAN_DOMAIN_SEPARATOR');
  const terms=keccak256(encodeAbiParameters(parseAbiParameters('bytes32,address,address,uint256,uint256,uint256,bool,bytes32'),[typehash,p.offer.market.collateralParams[0].token,p.offer.market.loanToken,(p.units*10n**36n+p.collateral-1n)/p.collateral,p.collateral,p.offer.market.maturity,true,tradeId]));
  const sig=parseSignature(await operator.sign({hash:keccak256(concat(['0x1901',domain,terms]))}));
  const attestation=encodeAbiParameters(parseAbiParameters('uint8,bytes32,bytes32'),[Number(sig.v??BigInt(27+sig.yParity)),sig.r,sig.s]);
  await tx(operator,core,awakeningAbi,'completeTake',[id,0n,tradeId,attestation],'Complete simulated test protection');
}
async function indexed(walletAddress,predicate,label){
  const until=Date.now()+120000;
  while(Date.now()<until){try{const data=await request(`/accounts/${walletAddress}`);if(predicate(data)){check(true,label);return data;}}catch{}await new Promise(r=>setTimeout(r,2500));}
  throw Error(`Index timeout: ${label}`);
}
try {
  check(await client.getBalance({address:operator.address})>10000000000000000n,'At least 0.01 test BNB available; funding capped at 0.006 test BNB');
  check(await read(core,awakeningAbi,'debtOf',[marketId,operator.address])===0n,'No existing operator debt: do not seed twice');
  check(await read(core,awakeningAbi,'borrowerLoan',[marketId,operator.address])==='0x'+'0'.repeat(64),'No existing operator loan pointer');
  await fund(lender);await fund(borrower);
  for(const actor of [lender,borrower,operator])await tx(actor,addresses.TestUSDC,testTokenAbi,'faucet',[],'Mint valueless test USDC');
  for(const actor of [borrower,operator])await tx(actor,addresses.TestBTC,testTokenAbi,'faucet',[],'Mint valueless test BTC');
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  await tx(operator,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  await tx(lender,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,lender.address]);
  const lend=await signedOffer(market,true,lender);
  const id=pendingId(await tx(operator,core,awakeningAbi,'takeInit',[lend.offer,lend.data,units,collateral,operator.address],'Create operator borrow position: 500 USDC'));
  report.borrowLoanId=id;save();await complete(id);
  const lending=300000000n,pledge=750000n;
  await tx(operator,addresses.TestUSDC,testTokenAbi,'approve',[core,lending]);
  await tx(operator,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,operator.address]);
  await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,pledge]);
  const creditOrder=await signedOffer(market,true,operator,lending);
  const creditLoan=pendingId(await tx(borrower,core,awakeningAbi,'takeInit',[creditOrder.offer,creditOrder.data,lending,pledge,borrower.address],'Create operator lend position: 300 USDC'));
  report.lendLoanId=creditLoan;save();await complete(creditLoan);
  await tx(borrower,addresses.TestUSDC,testTokenAbi,'approve',[core,100000000n]);
  await tx(borrower,addresses.AwakeningSettlement,awakeningSettlementAbi,'repay',[marketId,100000000n],'Partial repayment: leave 100 USDC available to claim');
  // A live lend order, not a fictitious order or a second borrow for an already indebted account.
  await tx(operator,addresses.TestUSDC,testTokenAbi,'approve',[core,200000000n]);
  const open=await signedOffer(market,true,operator,200000000n);
  await request('/orders',{chainId:97,awakeningAddress:core,marketId,offer:open.offer,signature:open.signature,root:open.root});
  report.signedOrderRoot=open.root;
  report.account=await indexed(operator.address,d=>d.positions.some(p=>p.marketId===marketId&&p.debt==='500000000'&&p.credit==='300000000'),'Indexer exposes operator borrow and lend balances');
  // Account balances can be indexed before the later repayment event. Wait for both views.
  for(let attempt=0;attempt<40;attempt++){
    const m=await request('/markets');report.market=m.markets.find(m=>m.id===marketId);
    if(BigInt(report.market.withdrawable)>=100000000n)break;
    await new Promise(resolve=>setTimeout(resolve,2500));
  }
  check(BigInt(report.market.withdrawable)>=100000000n,'At least 100 USDC is available for lender withdrawal');
  report.complete=true;save();console.log('Public receipt report:',output);
} catch(e){report.error=e.shortMessage??e.message;save();console.error(report.error);process.exitCode=1;}

