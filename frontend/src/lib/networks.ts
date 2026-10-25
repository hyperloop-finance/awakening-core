import {defineChain} from 'viem';
import {arbitrumSepolia, bscTestnet} from 'viem/chains';

export const robinhoodTestnet = defineChain({id:46630,name:'Robinhood Testnet',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc.testnet.chain.robinhood.com']}},blockExplorers:{default:{name:'Robinhood Explorer',url:'https://explorer.testnet.chain.robinhood.com'}},testnet:true});
export const ACTIVE_PROFILE = process.env.NEXT_PUBLIC_TESTNET ?? 'bsc-testnet';
if(!['bsc-testnet','arbitrum-sepolia','robinhood-testnet'].includes(ACTIVE_PROFILE)) throw Error('Unknown NEXT_PUBLIC_TESTNET');
export const ACTIVE_CHAIN = ACTIVE_PROFILE==='arbitrum-sepolia'?arbitrumSepolia:ACTIVE_PROFILE==='robinhood-testnet'?robinhoodTestnet:bscTestnet;
export const ACTIVE_CHAIN_ID = ACTIVE_CHAIN.id;
export const ACTIVE_CHAIN_LABEL = ACTIVE_PROFILE==='arbitrum-sepolia'?'Arbitrum Testnet':ACTIVE_PROFILE==='robinhood-testnet'?'Robinhood Testnet':'BNB Testnet';
export const EXPLORER_URL = ACTIVE_CHAIN.blockExplorers.default.url;
export const BASE_PATH = ACTIVE_PROFILE==='robinhood-testnet'?'/robinhood':'';
export const assetPath = (path:string) => path.startsWith('/')?`${BASE_PATH}${path}`:path;
export type NetworkEntry = {key:string;label:string;environment:'mainnet'|'testnet';status:'enabled'|'coming-soon';chainId?:number;url?:string};
export const NETWORKS:readonly NetworkEntry[] = [
  {key:'arbitrum-sepolia',label:'Arbitrum Testnet',environment:'testnet',status:'enabled',chainId:421614,url:process.env.NEXT_PUBLIC_ARBITRUM_APP_URL??'/markets'},
  {key:'robinhood-testnet',label:'Robinhood Testnet',environment:'testnet',status:'enabled',chainId:46630,url:process.env.NEXT_PUBLIC_ROBINHOOD_APP_URL??'/robinhood/markets'},
  ...['Arbitrum','Robinhood'].map(label=>({key:`${label.toLowerCase()}-mainnet`,label:`${label} Mainnet`,environment:'mainnet' as const,status:'coming-soon' as const})),
];
export function isSupportedWalletChain(chainId?:number) {return chainId===ACTIVE_CHAIN_ID;}

export function navigateToNetwork(network:NetworkEntry) {if(network.url)window.location.assign(network.url);}
