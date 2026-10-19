import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletControls, WalletProvider } from './wallet';

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
  it('keeps future networks disabled and only requests chain 97',async()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    expect(screen.getByRole('tab',{name:'Testnets'})).toHaveAttribute('aria-selected','true');
    expect(screen.getAllByText('Coming soon')).toHaveLength(4);
    expect(screen.queryByRole('button',{name:/Arbitrum Mainnet/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'Mainnets'}));
    expect(screen.getAllByText('Coming soon')).toHaveLength(5);
    expect(screen.getByRole('button',{name:/Arbitrum Mainnet/})).toBeDisabled();
    expect(state.switchChain).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'Testnets'}));
    fireEvent.click(screen.getByRole('button',{name:'Switch to BNB Testnet'}));
    await waitFor(()=>expect(state.switchChain).toHaveBeenCalledWith({chainId:97}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('retains network switching errors and permits retry',async()=>{
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;
    state.switchChain.mockRejectedValueOnce({code:4001});mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    fireEvent.click(screen.getByRole('button',{name:'Switch to BNB Testnet'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i);
    fireEvent.click(screen.getByRole('button',{name:'Switch to BNB Testnet'}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('closes the network dropdown on Escape and restores focus',()=>{
    mount();const trigger=screen.getByRole('button',{name:/Select network/});
    trigger.focus();fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog',{name:'Select network'}),{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();
  });
});
