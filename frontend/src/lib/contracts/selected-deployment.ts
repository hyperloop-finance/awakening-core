import {deployment as bscDeployment} from './generated';
const selectedManifest:unknown = JSON.parse(process.env.NEXT_PUBLIC_DEPLOYMENT_MANIFEST ?? '{}');
import {ACTIVE_PROFILE, ACTIVE_CHAIN_ID} from '../networks';
export * from './generated';
export const deployment = (ACTIVE_PROFILE==='bsc-testnet'?bscDeployment:selectedManifest) as unknown as typeof bscDeployment;
if(Number(deployment.chainId)!==ACTIVE_CHAIN_ID) throw Error('Deployment does not match selected testnet');
