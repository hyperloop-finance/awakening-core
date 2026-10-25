// Explicit disposable-testnet acceptance. No secrets are written or printed.
import {createPublicClient,createWalletClient,http,defineChain,encodeAbiParameters,parseAbiParameters,keccak256,concat,parseSignature,decodeEventLog,zeroAddress,toHex,hashStruct,parseEther} from 'viem';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const configs={
 'arbitrum-sepolia':{id:421614,rpc:'https://sepolia-rollup.arbitrum.io/rpc',port:8083},
 'robinhood-testnet':{id:46630,rpc:'https://rpc.testnet.chain.robinhood.com',port:8084},
};
const selected=process.argv[2],network=selected==='421614'?'arbitrum-sepolia':selected==='46630'?'robinhood-testnet':selected;
const config=configs[network],mode=process.argv[3];
if(!config||!['--broadcast-testnet','--check'].includes(mode))throw Error('Usage: multichain-acceptance.mjs NETWORK_OR_CHAIN_ID --check|--broadcast-testnet');
const deployment=JSON.parse(readFileSync(resolve(root,`contracts/deployments/${network}-${config.id}.json`),'utf8'));
if(deployment.chainId!==config.id||!deployment.verification?.complete)throw Error('Real verified deployment manifest required');
function abi(name){return JSON.parse(readFileSync(resolve(root,`contracts/out-multichain/${name}.sol/${name}.json`),'utf8')).abi;}
const awakeningAbi=abi('Awakening'),awakeningSettlementAbi=abi('AwakeningSettlement'),attestedPATAbi=abi('AttestedPAT'),ecrecoverRatifierAbi=abi('EcrecoverRatifier'),testTokenAbi=abi('TestToken'),eventsLibAbi=abi('EventsLib');
const chain=defineChain({id:config.id,name:network,nativeCurrency:{name:'Test Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[config.rpc]}},testnet:true});
const rpc=process.env.AWAKENING_ACCEPTANCE_RPC_URL??config.rpc;
const client=createPublicClient({chain,transport:http(rpc,{timeout:15000,retryCount:2}),pollingInterval:500});
if(await client.getChainId()!==config.id)throw Error('Wrong RPC chain');
const addresses=deployment.contracts,core=addresses.Awakening,api=process.env.AWAKENING_ACCEPTANCE_API_URL??`http://127.0.0.1:${config.port}/api/v1/chain`;
for(const [name,address]of Object.entries(addresses))if(!/^0x[0-9a-fA-F]{40}$/.test(address)||BigInt(address)===0n)throw Error('Invalid deployed address '+name);
const runtimeResponse=await fetch(api.replace(/\/chain$/,'/config'),{signal:AbortSignal.timeout(25000)});
if(!runtimeResponse.ok)throw Error('Backend config unavailable');
const runtime=await runtimeResponse.json();
if(runtime.chainId!==config.id||runtime.profile!==network||runtime.verificationStatus!=='VERIFIED'||!runtime.transactionsEnabled||runtime.awakeningAddress.toLowerCase()!==core.toLowerCase())throw Error('Backend deployment/profile is not ready');
const marketResponse=await fetch(api+'/markets',{signal:AbortSignal.timeout(25000)});
if(!marketResponse.ok)throw Error('Chain index is not ready');
const snapshot=await marketResponse.json();
if(snapshot.chainId!==config.id||!snapshot.markets?.length)throw Error('Wrong or empty chain index');
if(mode==='--check'){console.log(JSON.stringify({network,chainId:config.id,awakening:core,api,indexedMarkets:snapshot.markets.length,verified:true}));process.exit(0);}
const offerTypes={
 CollateralParams:[{name:'token',type:'address'},{name:'oracle',type:'address'}],
 Market:[{name:'loanToken',type:'address'},{name:'collateralParams',type:'CollateralParams[]'},{name:'maturity',type:'uint256'},{name:'maxStrike',type:'uint256'},{name:'penaltyPct',type:'uint256'},{name:'enterGate',type:'address'}],
 Offer:[{name:'market',type:'Market'},{name:'buy',type:'bool'},{name:'maker',type:'address'},{name:'start',type:'uint256'},{name:'expiry',type:'uint256'},{name:'tick',type:'uint256'},{name:'group',type:'bytes32'},{name:'callback',type:'address'},{name:'callbackData',type:'bytes'},{name:'receiverIfMakerIsSeller',type:'address'},{name:'ratifier',type:'address'},{name:'reduceOnly',type:'bool'},{name:'maxUnits',type:'uint256'},{name:'maxAssets',type:'uint256'}],
 OfferTree:[{name:'offerTree',type:'Offer'}],
};
function hashOffer(offer){return hashStruct({data:offer,primaryType:'Offer',types:offerTypes});}
function offerTypedData(offer){return {domain:{chainId:config.id,verifyingContract:offer.ratifier},types:offerTypes,primaryType:'OfferTree',message:{offerTree:offer}};}
function ratifierData(offer,signature){const sig=parseSignature(signature);return encodeAbiParameters(parseAbiParameters('(uint8 v,bytes32 r,bytes32 s),bytes32,uint256,bytes32[]'),[{v:Number(sig.v??BigInt(27+(sig.yParity??0))),r:sig.r,s:sig.s},hashOffer(offer),0n,[]]);}
const report={network,chainId:config.id,startedAt:new Date().toISOString(),protection:'SIMULATED_TEST_PROTECTION',transactions:[],checks:[],complete:false};
const reports=resolve(dirname(fileURLToPath(import.meta.url)),'../../.local-runtime');
const output=resolve(reports,`multichain-acceptance-${network}-${Date.now()}.json`);
function save(){mkdirSync(reports,{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
function check(ok,label){if(!ok)throw Error(label);report.checks.push(label);save();console.log('PASS',label);}
const keyDirectory=process.env.AWAKENING_KEYSTORE_DIR,passwordFile=process.env.AWAKENING_KEYSTORE_PASSWORD_FILE;
if(!keyDirectory||!passwordFile)throw Error('Encrypted signer configuration required');
let decrypted;
try {
 decrypted=execFileSync('cast',['wallet','decrypt-keystore','operator','--keystore-dir',keyDirectory],{env:{...process.env,CAST_UNSAFE_PASSWORD:readFileSync(passwordFile,'utf8').trim()},encoding:'utf8',stdio:['ignore','pipe','pipe']});
}catch{throw Error('Unable to unlock encrypted operator');}
let secretValue=decrypted.match(/(?:0x)?[a-fA-F0-9]{64}/)?.[0];
if(!secretValue)throw Error('Unable to unlock signing account');
const operator=privateKeyToAccount(secretValue.startsWith('0x')?secretValue:'0x'+secretValue);secretValue='';decrypted='';
check(operator.address.toLowerCase()===deployment.deployer.toLowerCase(),'Disposable operator identity');
const lender=privateKeyToAccount(generatePrivateKey()),borrower=privateKeyToAccount(generatePrivateKey());
report.actors={operator:operator.address,lender:lender.address,borrower:borrower.address};save();
const wallet=account=>createWalletClient({account,chain,transport:http(rpc,{timeout:15000,retryCount:1})});
async function read(address,abi,functionName,args=[]){return client.readContract({address,abi,functionName,args});}
async function tx(account,address,abi,functionName,args=[],label=functionName){
  const {request}=await client.simulateContract({account,address,abi,functionName,args});
  const hash=await wallet(account).writeContract(request);
  const receipt=await client.waitForTransactionReceipt({hash,confirmations:1,timeout:120000});
  report.transactions.push({label,actor:account.address,to:address,hash,block:Number(receipt.blockNumber),status:receipt.status,gasUsed:receipt.gasUsed.toString(),effectiveGasPrice:receipt.effectiveGasPrice.toString()});save();
  check(receipt.status==='success',label);return receipt;
}
async function fund(account){
  const hash=await wallet(operator).sendTransaction({to:account.address,value:parseEther('0.0003')});
  const r=await client.waitForTransactionReceipt({hash,confirmations:1});
  report.transactions.push({label:'Fund ephemeral test wallet',actor:operator.address,to:account.address,hash,block:Number(r.blockNumber),status:r.status,valueWei:parseEther('0.0003').toString(),gasUsed:r.gasUsed.toString(),effectiveGasPrice:r.effectiveGasPrice.toString()});save();check(r.status==='success','Test gas funding');
}
async function request(path,body){
  const response=await fetch(api+path,body?{signal:AbortSignal.timeout(25000),method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body,(_,v)=>typeof v==='bigint'?v.toString():v)}:{signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok)throw Error(`API ${response.status}: ${data.detail??data.message??'unavailable'}`);if(data.chainId!==config.id)throw Error('Wrong API response chain');return data;
}
function marketOf(m){return {...m,collateralParams:m.collateralParams.map(c=>({...c})),maturity:BigInt(m.maturity),maxStrike:BigInt(m.maxStrike),penaltyPct:BigInt(m.penaltyPct)};}
const normalMarket=deployment.markets.find(m=>m.purpose==='normal')??deployment.markets[0];
const market=marketOf(normalMarket.market),marketId=normalMarket.id,units=100000000n,collateral=250000n;
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
  check(await client.getBalance({address:operator.address})>=parseEther('0.001'),'Test operator has bounded gas budget');
  await fund(lender);await fund(borrower);
  for(const name of ['TestBTC','TestUSDC','TestUSDT','TestTesla','TestNVIDIA']) {
    const before=await read(addresses[name],testTokenAbi,'balanceOf',[operator.address]);
    await tx(operator,addresses[name],testTokenAbi,'faucet',[],'Claim '+name+' faucet');
    check(await read(addresses[name],testTokenAbi,'balanceOf',[operator.address])>before,name+' faucet credits wallet');
  }
  for(const actor of [lender,borrower])await tx(actor,addresses.TestUSDC,testTokenAbi,'faucet',[],'Mint valueless test USDC');
  await tx(borrower,addresses.TestBTC,testTokenAbi,'faucet',[],'Mint valueless test BTC');
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  await tx(lender,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,lender.address]);
  const order=await signedOffer(market,true,lender);
  const body={chainId:config.id,awakeningAddress:core,offer:order.offer,signature:order.signature,root:order.root};
  await request('/orders',body);await request('/orders',body);
  const list=await request(`/orders?maker=${lender.address}`);check(list.orders.filter(o=>o.root===order.root).length===1,'Relay duplicate submission is idempotent');
  const quote=await request(`/orders/${order.root}/quote?units=${units}&collateral=${collateral}&taker=${borrower.address}`);
  check(quote.chainId===config.id&&BigInt(quote.buyerAssets)>0n,'API quote uses selected chain');
  const receipt=await tx(borrower,core,awakeningAbi,'takeInit',[order.offer,order.data,units,collateral,borrower.address],'Borrow against lender signed offer');
  const id=pendingId(receipt);report.normalLoanId=id;save();
  check((await read(core,awakeningAbi,'pendingTakes',[id])).escrowed===BigInt(quote.buyerAssets),'API quote matches actual onchain escrow');
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
  const shortMarket={...market,maturity:(await client.getBlock()).timestamp+60n};
  await tx(operator,core,awakeningAbi,'touchMarket',[shortMarket],'Create short-maturity acceptance market');
  const shortId=await read(core,awakeningAbi,'toId',[shortMarket]);
  report.shortMarket={id:shortId,label:'tBTC / tUSDC',purpose:'acceptance-short-expiry',market:JSON.parse(JSON.stringify(shortMarket,(_,v)=>typeof v==='bigint'?v.toString():v))};save();
  await tx(borrower,core,awakeningAbi,'setIsAuthorized',[addresses.EcrecoverRatifier,true,borrower.address]);
  await tx(borrower,addresses.TestBTC,testTokenAbi,'approve',[core,collateral]);
  await tx(lender,addresses.TestUSDC,testTokenAbi,'approve',[core,units]);
  const borrowOrder=await signedOffer(shortMarket,false,borrower);
  const shortLoan=pendingId(await tx(lender,core,awakeningAbi,'takeInit',[borrowOrder.offer,borrowOrder.data,units,collateral,lender.address],'Lend against borrower signed offer'));
  await complete(shortLoan);
  console.log('Waiting for real '+network+' maturity',shortMarket.maturity.toString());
  while((await client.getBlock()).timestamp<shortMarket.maturity)await new Promise(r=>setTimeout(r,5000));
  await tx(borrower,addresses.AwakeningSettlement,awakeningSettlementAbi,'readOracleAtMaturity',[shortId]);
  await tx(operator,addresses.AwakeningSettlement,awakeningSettlementAbi,'redeemPATs',[shortId]);
  await tx(operator,addresses.TestUSDC,testTokenAbi,'approve',[addresses.AwakeningSettlement,110000000n]);
  await tx(operator,addresses.AwakeningSettlement,awakeningSettlementAbi,'settle',[shortId,110000000n],'Settle matured test loan with simulated proceeds');
  await tx(lender,core,awakeningAbi,'withdraw',[shortMarket,units,lender.address,lender.address],'Claim matured lender payout');
  check(await read(core,awakeningAbi,'debtOf',[shortId,borrower.address])===0n,'Maturity settlement clears debt');
  await indexed(borrower.address,d=>d.pendingTakes.length===0,'Backend clears completed and cancelled pending takes');
  report.complete=true;report.finishedAt=new Date().toISOString();save();console.log('MULTICHAIN ACCEPTANCE COMPLETE',network,output);
} catch(error) {
  report.failure=error.shortMessage??error.message;save();console.error('ACCEPTANCE INCOMPLETE:',report.failure);process.exitCode=1;
}
