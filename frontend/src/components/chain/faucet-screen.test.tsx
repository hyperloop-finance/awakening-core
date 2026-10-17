import {act, render, screen, fireEvent, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {FaucetScreen} from './faucet-screen';
import {deployment} from '@/lib/contracts/generated';
import {faucetTokens} from '@/lib/contracts/faucet';
import type {RuntimeConfig} from '@/lib/api/types';

const mocks = vi.hoisted(() => ({wallet: undefined as string | undefined, chainId: 97, openWallet: vi.fn(), readContract: vi.fn(), tx: vi.fn(), check: vi.fn(), clearStatus: vi.fn(), switchChainAsync: vi.fn(), watchAsset:vi.fn(), getChainId:vi.fn(), getAddresses:vi.fn()}));
vi.mock('@/components/shell/wallet', () => ({useWalletIdentity: () => mocks}));
vi.mock('wagmi', () => ({usePublicClient: () => mocks, useSwitchChain: () => ({switchChainAsync: mocks.switchChainAsync}),useWalletClient:()=>({data:mocks})}));
vi.mock('./use-chain-wallet', () => ({useChainWallet: () => ({session: () => ({tx: mocks.tx, check: mocks.check}), clearStatus: mocks.clearStatus})}));
const config: RuntimeConfig = {profile:'bsc-testnet',chainId:97,rpcUrlConfigured:true,contractsReady:true,verificationStatus:'VERIFIED',transactionsEnabled:true,awakeningAddress:deployment.contracts.Awakening,settlementAddress:deployment.contracts.AwakeningSettlement,patAddress:deployment.contracts.AttestedPAT,optionVaultAddress:deployment.contracts.OptionVault,ratifierAddress:deployment.contracts.EcrecoverRatifier};
beforeEach(() => {vi.clearAllMocks(); mocks.wallet=undefined; mocks.chainId=97; mocks.readContract.mockResolvedValue(0n); mocks.tx.mockResolvedValue(`0x${'a'.repeat(64)}`); mocks.watchAsset.mockResolvedValue(true);mocks.getChainId.mockResolvedValue(97);mocks.getAddresses.mockResolvedValue([deployment.deployer]);});
it('offers wallet import for every token using real chain metadata, without a transaction',async()=>{
  mocks.wallet=deployment.deployer;
  render(<FaucetScreen config={config}/>);
  for(const name of ['BTC','USDC','USDT','bTesla','bNVIDIA']) expect(screen.getByRole('button',{name:`Add ${name} to wallet`})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Add BTC to wallet'}));
  await waitFor(()=>expect(mocks.watchAsset).toHaveBeenCalledWith({type:'ERC20',options:{address:deployment.contracts.TestBTC,symbol:'tBTC',decimals:8}}));
  expect(await screen.findByText('tBTC added to your wallet.')).not.toBeVisible();
  expect(mocks.tx).not.toHaveBeenCalled();
});
it('does not report a declined wallet import as successful',async()=>{
  mocks.wallet=deployment.deployer;mocks.watchAsset.mockResolvedValue(false);
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add USDC to wallet'}));
  expect(await screen.findByText(/Token was not added/)).toBeInTheDocument();
});
it.each(faucetTokens)('imports $symbol with its own address and decimals',async token=>{
  mocks.wallet=deployment.deployer;
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:`Add ${token.symbol} to wallet`}));
  await waitFor(()=>expect(mocks.watchAsset).toHaveBeenCalledWith({type:'ERC20',options:{address:token.address,symbol:token.onchainSymbol,decimals:token.decimals}}));
});
it('explains unsupported wallet import without issuing a transaction',async()=>{
  mocks.wallet=deployment.deployer;mocks.watchAsset.mockRejectedValue({code:4200});
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add BTC to wallet'}));
  expect(await screen.findByText(/does not support token import/)).toBeInTheDocument();
  expect(mocks.tx).not.toHaveBeenCalled();
});
it('connects or switches network before importing a token',async()=>{
  const view=render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add BTC to wallet'}));
  expect(mocks.openWallet).toHaveBeenCalled();
  mocks.wallet=deployment.deployer;mocks.chainId=1;
  view.rerender(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Add BTC to wallet'}));
  await waitFor(()=>expect(mocks.switchChainAsync).toHaveBeenCalledWith({chainId:97}));
  expect(mocks.watchAsset).not.toHaveBeenCalled();
});
it('shows five identifiable test assets and connects before claiming', () => {
  render(<FaucetScreen config={config}/>);
  expect(screen.queryByText('Chain ID 97')).not.toBeInTheDocument();
  expect(screen.queryByText('Ready for a test drive?')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:/Explore markets/})).toHaveAttribute('href','/markets');
  expect(screen.queryByText('Faucet')).not.toBeInTheDocument();
  for(const name of ['Bitcoin','USDC','USDT','bTesla','bNVIDIA']) expect(screen.getByRole('img',{name})).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Connect wallet'})[0]);
  expect(mocks.openWallet).toHaveBeenCalled(); expect(mocks.tx).not.toHaveBeenCalled();
});
it('switches the network without sending a claim', async () => {
  mocks.wallet=deployment.deployer; mocks.chainId=1;
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Switch to BNB Testnet'})[0]);
  await waitFor(() => expect(mocks.switchChainAsync).toHaveBeenCalledWith({chainId:97}));
  expect(mocks.tx).not.toHaveBeenCalled();
});
it('waits for confirmation, prevents duplicate claims and links the receipt', async () => {
  mocks.wallet=deployment.deployer;
  let finish!: (hash: string) => void;
  mocks.tx.mockImplementation(() => new Promise(resolve => {finish=resolve;}));
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Claim BTC'}));
  expect(screen.getByRole('button',{name:'Claim USDC'})).toBeDisabled();
  expect(screen.queryByText(/received successfully/)).not.toBeInTheDocument();
  finish(`0x${'a'.repeat(64)}`);
  expect(await screen.findByText(/1,000 BTC received successfully/)).toBeInTheDocument();
  expect(screen.getByText('View transaction')).not.toBeVisible();
  expect(screen.getByText('View transaction')).toHaveAttribute('href',`https://testnet.bscscan.com/tx/0x${'a'.repeat(64)}`);
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});
it('does not turn a balance RPC failure into a zero balance and permits retry', async () => {
  mocks.wallet=deployment.deployer; mocks.readContract.mockRejectedValue(Error('RPC offline'));
  render(<FaucetScreen config={config}/>);
  expect(await screen.findByText(/Balances unavailable/)).not.toBeVisible();
  expect(screen.queryByText('0 BTC')).not.toBeInTheDocument();
  mocks.readContract.mockResolvedValue(0n);
  const refreshButton=screen.getByRole('button',{name:'Refresh balances'});
  expect(refreshButton).toHaveClass('aw-refresh');
  expect(refreshButton).toHaveTextContent('Refresh');
  expect(refreshButton.querySelector('svg')).not.toBeNull();
  fireEvent.click(refreshButton);
  expect(await screen.findByText('0 BTC')).toBeInTheDocument();
});
it('shows claim failure without success and re-enables retry', async () => {
  mocks.wallet=deployment.deployer; mocks.tx.mockRejectedValue(Error('User rejected the request'));
  render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Claim BTC'}));
  expect(await screen.findByText(/Request rejected/)).not.toBeVisible();
  expect(screen.getByRole('button',{name:'Claim BTC'})).toBeEnabled();
  expect(screen.queryByRole('link',{name:'View transaction'})).not.toBeInTheDocument();
});
it('never enables a claim for an unverified runtime', () => {
  mocks.wallet=deployment.deployer;
  render(<FaucetScreen config={{...config,transactionsEnabled:false}}/>);
  expect(screen.getByRole('button',{name:'Claim BTC'})).toBeDisabled();
  expect(screen.getByText(/Testnet transactions are currently unavailable/)).not.toBeVisible();
});
it('clears account state and ignores a late receipt after a wallet switch',async()=>{
  mocks.wallet=deployment.deployer;
  let finish!:(hash:string)=>void;
  mocks.tx.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const view=render(<FaucetScreen config={config}/>);
  fireEvent.click(screen.getByRole('button',{name:'Claim BTC'}));
  mocks.wallet='0x1111111111111111111111111111111111111111';
  view.rerender(<FaucetScreen config={config}/>);
  await act(async()=>finish(`0x${'a'.repeat(64)}`));
  expect(screen.queryByText(/received successfully/)).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Claim BTC'})).toBeEnabled();
});
