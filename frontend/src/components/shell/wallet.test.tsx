import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletControls, WalletProvider } from './wallet';
import * as networks from '@/lib/networks';
vi.spyOn(networks,'navigateToNetwork').mockImplementation(()=>{});

const state=vi.hoisted(()=>({
  address:undefined as `0x${string}`|undefined, chainId:undefined as number|undefined,
  openConnect:vi.fn(),openAccount:vi.fn(),switchChain:vi.fn(),
}));
vi.mock('@rainbow-me/rainbowkit',()=>({
  useConnectModal:()=>({openConnectModal:state.openConnect}),
  useAccountModal:()=>({openAccountModal:state.openAccount}),
}));
vi.mock('wagmi',()=>({
  useAccount:()=>({address:state.address,chainId:state.chainId,isConnected:!!state.address}),
  useSwitchChain:()=>({switchChainAsync:state.switchChain}),
}));
beforeEach(()=>{vi.clearAllMocks();state.address=undefined;state.chainId=undefined;state.switchChain.mockResolvedValue({id:97});});
const mount=()=>render(<WalletProvider><WalletControls/></WalletProvider>);

describe('RainbowKit wallet controls',()=>{
  it('opens wallet selection when disconnected',()=>{
    mount();fireEvent.click(screen.getByRole('button',{name:'Connect wallet'}));
    expect(state.openConnect).toHaveBeenCalledOnce();expect(state.openAccount).not.toHaveBeenCalled();
  });
  it('opens account management and shows the connected address',()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=97;mount();
    const button=screen.getByRole('button',{name:'Manage wallet'});
    expect(button).toHaveTextContent('0x1111…1111');fireEvent.click(button);
    expect(state.openAccount).toHaveBeenCalledOnce();expect(state.openConnect).not.toHaveBeenCalled();
  });
  it('enables both testnets while keeping mainnets disabled',async()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    expect(screen.getByRole('tab',{name:'Testnets'})).toHaveAttribute('aria-selected','true');
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Arbitrum Mainnet/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'Mainnets'}));
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
    expect(screen.getByRole('button',{name:/Arbitrum Mainnet/})).toBeDisabled();
    expect(state.switchChain).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'Testnets'}));
    fireEvent.click(screen.getByRole('button',{name:'Switch to Arbitrum Testnet'}));
    await waitFor(()=>expect(state.switchChain).toHaveBeenCalledWith({chainId:421614}));
    expect(networks.navigateToNetwork).toHaveBeenCalledWith(expect.objectContaining({url:'/markets'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('switches the wallet to Robinhood before navigating to its build',async()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=421614;mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    fireEvent.click(screen.getByRole('button',{name:'Switch to Robinhood Testnet'}));
    await waitFor(()=>expect(state.switchChain).toHaveBeenCalledWith({chainId:46630}));
    await waitFor(()=>expect(networks.navigateToNetwork).toHaveBeenCalledWith(expect.objectContaining({url:'/robinhood/markets'})));
  });
  it('retains network switching errors and permits retry',async()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;
    state.switchChain.mockRejectedValueOnce({code:4001});mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    fireEvent.click(screen.getByRole('button',{name:'Switch to Arbitrum Testnet'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i);
    expect(networks.navigateToNetwork).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Switch to Arbitrum Testnet'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('closes the network dropdown on Escape and restores focus',()=>{
    mount();const trigger=screen.getByRole('button',{name:/Select network/});
    trigger.focus();fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog',{name:'Select network'}),{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();
  });
});
