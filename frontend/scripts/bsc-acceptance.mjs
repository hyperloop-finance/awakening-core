// Explicit disposable-testnet acceptance harness. No keys are written or printed.
import {createPublicClient,createWalletClient,http,encodeAbiParameters,parseAbiParameters,keccak256,concat,parseSignature,decodeEventLog,zeroAddress,toHex} from 'viem';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';
import {bscTestnet} from 'viem/chains';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deployment,awakeningAbi,awakeningSettlementAbi,attestedPATAbi,ecrecoverRatifierAbi,testTokenAbi,eventsLibAbi} from '../src/lib/contracts/generated.ts';
import {hashOffer,offerTypedData,ratifierData} from '../src/lib/contracts/offer-tree.ts';

if(process.argv[2]!=='--broadcast-testnet')throw Error('Explicit --broadcast-testnet is required');
const client=createPublicClient({chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com',{timeout:15000,retryCount:2}),pollingInterval:1200});
if(await client.getChainId()!==97)throw Error('Wrong RPC chain');
const addresses=deployment.contracts,core=addresses.Awakening,api='http://127.0.0.1:8082/api/v1/chain';
const report={chainId:97,startedAt:new Date().toISOString(),protection:'SIMULATED_TEST_PROTECTION',transactions:[],checks:[],complete:false};
const reports=resolve(dirname(fileURLToPath(import.meta.url)),'../../.local-runtime');
const output=resolve(reports,`bsc-acceptance-${Date.now()}.json`);
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
const market=marketOf(deployment.markets[0].market),marketId=deployment.markets[0].id,units=100000000n,collateral=250000n;
async function signedOffer(m,buy,maker){
  const now=(await client.getBlock()).timestamp;
  const offer={market:m,buy,maker:maker.address,start:now-30n,expiry:now+3600n<m.maturity?now+3600n:m.maturity-1n,tick:4000n,group:toHex(crypto.getRandomValues(new Uint8Array(32))),callback:zeroAddress,callbackData:'0x',receiverIfMakerIsSeller:maker.address,ratifier:addresses.EcrecoverRatifier,reduceOnly:false,maxUnits:units,maxAssets:0n};
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
  check(await client.getBalance({address:operator.address})>10000000000000000n,'Test operator has bounded gas budget');
  await fund(lender);await fund(borrower);
  for(const actor of [lender,borrower,operator])await tx(actor,addresses.TestUSDC,testTokenAbi,'faucet',[],'Mint valueless test USDC');
  await tx(borrower,addresses.TestBTC,testTokenAbi,'faucet',[],'Mint valueless test BTC');
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  await tx(lender,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,lender.address]);
  const order=await signedOffer(market,true,lender);
  const body={chainId:97,awakeningAddress:core,offer:order.offer,signature:order.signature,root:order.root};
  await request('/orders',body);await request('/orders',body);
  const list=await request(`/orders?maker=${lender.address}`);check(list.orders.filter(o=>o.root===order.root).length===1,'Relay duplicate submission is idempotent');
  const quote=await request(`/orders/${order.root}/quote?units=${units}&collateral=${collateral}&taker=${borrower.address}`);
  check(quote.buyerAssets==='99566400','API quote matches Solidity price');
  const receipt=await tx(borrower,core,awakeningAbi,'takeInit',[order.offer,order.data,units,collateral,borrower.address],'Borrow against lender signed offer');
  const id=pendingId(receipt);report.normalLoanId=id;save();
  check(await read(core,awakeningAbi,'debtOf',[marketId,borrower.address])===0n,'Pending escrow is not active debt');
  await indexed(borrower.address,d=>d.pendingTakes.some(p=>p.pendingId===id),'Backend displays pending escrow');
  await complete(id);
  await indexed(borrower.address,d=>d.loans.some(l=>l.loanId===id&&l.principal===units.toString()),'Backend displays completed loan');
  await tx(borrower,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  await tx(borrower,addresses.AwakeningSettlement,awakeningSettlementAbi,'repay',[marketId,25000000n],'Partial repay through settlement');
  check(await read(core,awakeningAbi,'debtOf',[marketId,borrower.address])===75000000n,'Partial repayment reduces debt');
  await tx(borrower,addresses.AwakeningSettlement,awakeningSettlementAbi,'repay',[marketId,75000000n],'Full repayment');
  check(await read(core,awakeningAbi,'collateral',[marketId,borrower.address,0n])===0n,'Full repayment returns collateral');
  await tx(lender,core,awakeningAbi,'withdraw',[market,units,lender.address,lender.address],'Claim lender payout');
  await tx(operator,addresses.TestUSDC,testTokenAbi,'approve',[addresses.AwakeningSettlement,20000000n]);
  await tx(operator,addresses.AwakeningSettlement,awakeningSettlementAbi,'reportPutResale',[marketId,id,20000000n],'Report simulated put resale');
  await tx(borrower,core,awakeningAbi,'claimPutProceeds',[id,borrower.address],'Claim residual proceeds');
  await tx(lender,addresses.EcrecoverRatifier,ecrecoverRatifierAbi,'cancelRoot',[lender.address,order.root],'Cancel signed order on-chain');
  check(await read(addresses.EcrecoverRatifier,ecrecoverRatifierAbi,'isRootCanceled',[lender.address,order.root]),'Root cancellation confirmed');
  // Pending cancellation is tested by the authorized keeper; public timeout guard is covered in Solidity.
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  const cancelOrder=await signedOffer(market,true,lender);
  const cancelledId=pendingId(await tx(borrower,core,awakeningAbi,'takeInit',[cancelOrder.offer,cancelOrder.data,units,collateral,borrower.address]));
  await tx(operator,core,awakeningAbi,'cancelTake',[cancelledId],'Refund pending escrow');
  // A fresh, short market uses the same test assets/oracle; no new core contracts.
  const shortMarket={...market,maturity:(await client.getBlock()).timestamp+180n};
  await tx(operator,core,awakeningAbi,'touchMarket',[shortMarket],'Create short-maturity acceptance market');
  const shortId=await read(core,awakeningAbi,'toId',[shortMarket]);
  report.shortMarket={id:shortId,label:'tBTC / tUSDC',purpose:'acceptance-short-expiry',market:JSON.parse(JSON.stringify(shortMarket,(_,v)=>typeof v==='bigint'?v.toString():v))};save();
  await tx(borrower,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,borrower.address]);
  await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  const borrowOrder=await signedOffer(shortMarket,false,borrower);
  const shortLoan=pendingId(await tx(lender,core,awakeningAbi,'takeInit',[borrowOrder.offer,borrowOrder.data,units,collateral,lender.address],'Lend against borrower signed offer'));
  await complete(shortLoan);
  console.log('Waiting for real BNB Testnet maturity',shortMarket.maturity.toString());
  while((await client.getBlock()).timestamp<shortMarket.maturity)await new Promise(r=>setTimeout(r,5000));
  await tx(borrower,addresses.AwakeningSettlement,awakeningSettlementAbi,'readOracleAtMaturity',[shortId]);
  await tx(operator,addresses.AwakeningSettlement,awakeningSettlementAbi,'redeemPATs',[shortId]);
  await tx(operator,addresses.TestUSDC,testTokenAbi,'approve',[addresses.AwakeningSettlement,110000000n]);
  await tx(operator,addresses.AwakeningSettlement,awakeningSettlementAbi,'settle',[shortId,110000000n],'Settle matured test loan with simulated proceeds');
  await tx(lender,core,awakeningAbi,'withdraw',[shortMarket,units,lender.address,lender.address],'Claim matured lender payout');
  check(await read(core,awakeningAbi,'debtOf',[shortId,borrower.address])===0n,'Maturity settlement clears debt');
  await indexed(borrower.address,d=>d.pendingTakes.length===0,'Backend clears completed and cancelled pending takes');
  report.complete=true;report.finishedAt=new Date().toISOString();save();console.log('BSC ACCEPTANCE COMPLETE',output);
} catch(error) {
  report.failure=error.shortMessage??error.message;save();console.error('ACCEPTANCE INCOMPLETE:',report.failure);process.exitCode=1;
}
