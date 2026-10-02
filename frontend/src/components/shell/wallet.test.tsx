import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletControls, WalletProvider } from './wallet';

const state = vi.hoisted(() => ({
  address: undefined as `0x${string}` | undefined,
  chainId: undefined as number | undefined,
  connectors: [] as {uid:string; id:string; name:string; type:string; getProvider:()=>Promise<object|undefined>}[],
  connect: vi.fn(), switchChain: vi.fn(), disconnect: vi.fn(),
  balance: { data: undefined as {value:bigint; decimals:number; symbol:string}|undefined, isError: false, isPending:false },
}));
vi.mock('wagmi', () => ({
  useAccount: () => ({address:state.address,chainId:state.chainId,isConnected:!!state.address,status:state.address?'connected':'disconnected'}),
  useConnect: () => ({connectors:state.connectors,connectAsync:state.connect,isPending:false}),
  useDisconnect: () => ({disconnectAsync:state.disconnect,isPending:false}),
  useSwitchChain: () => ({switchChainAsync:state.switchChain,isPending:false}),
  useBalance: () => state.balance,
}));
function mount() { return render(<WalletProvider><WalletControls /></WalletProvider>); }
beforeEach(() => {
  vi.clearAllMocks(); state.address=undefined; state.chainId=undefined;
  state.connectors=['MetaMask','Rabby'].map(name=>({uid:name,id:name,name,type:'injected',getProvider:async()=>({})}));
  state.balance={data:undefined,isError:false,isPending:false};
  state.connect.mockResolvedValue({}); state.switchChain.mockResolvedValue({id:97}); state.disconnect.mockResolvedValue(undefined);
});
describe('real wallet controls', () => {
  it('keeps the pending connection lock across closing and reopening the dialog', async () => {
    let resolve!: (value: unknown) => void;
    state.connect.mockImplementationOnce(() => new Promise(accept => { resolve = accept; }));
    mount();
    fireEvent.click(screen.getByRole('button', {name:'Connect wallet'}));
    fireEvent.click(await screen.findByRole('button', {name:'MetaMask'}));
    expect(screen.getByRole('button', {name:'Rabby'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name:'Close'}));
    fireEvent.click(screen.getByRole('button', {name:'Connect wallet'}));
    const other = await screen.findByRole('button', {name:'Rabby'});
    expect(other).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Approve the connection/);
    fireEvent.click(other);
    expect(state.connect).toHaveBeenCalledTimes(1);
    resolve({});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('offers discovered wallets, never a demo identity', async () => {
    mount();
    expect(screen.queryByText('Use demo wallet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Connect wallet'}));
    const dialog=screen.getByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button',{name:'MetaMask'}));
    await waitFor(()=>expect(state.connect).toHaveBeenCalledWith(expect.objectContaining({connector:state.connectors[0]})));
  });
  it('reports rejection and permits retry without auto prompting', async () => {
    state.connect.mockRejectedValueOnce({code:4001}); mount();
    fireEvent.click(screen.getByRole('button',{name:'Connect wallet'}));
    fireEvent.click(await screen.findByRole('button',{name:'Rabby'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i);
    expect(state.connect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'Rabby'}));
    await waitFor(()=>expect(state.connect).toHaveBeenCalledTimes(2));
  });
  it('disables future networks and only requests chain 97', async () => {
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;mount();
    fireEvent.click(screen.getByRole('button',{name:/Select network/}));
    expect(screen.getAllByText('Coming soon')).toHaveLength(9);
    expect(screen.getByRole('button',{name:/Arbitrum Mainnet/})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Switch to BNB Testnet'}));
    await waitFor(()=>expect(state.switchChain).toHaveBeenCalledWith({chainId:97}));
  });
  it('does not show wrong-network balance or wrong explorer', async () => {
    state.address='0x1111111111111111111111111111111111111111';state.chainId=56;
    state.balance.data={value:BigInt('1230000000000000000'),decimals:18,symbol:'BNB'};mount();
    fireEvent.click(screen.getByRole('button',{name:'Manage wallet'}));
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsupported network');
    expect(screen.queryByText(/1.23/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:/explorer/i})).not.toBeInTheDocument();
  });
  it('shows unavailable rather than zero on an RPC failure and can disconnect', async () => {
    state.address='0x1111111111111111111111111111111111111111';state.chainId=97;state.balance.isError=true;mount();
    fireEvent.click(screen.getByRole('button',{name:'Manage wallet'}));
    expect(screen.getByText('Balance unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Disconnect'}));
    await waitFor(()=>expect(state.disconnect).toHaveBeenCalledTimes(1));
  });
  it('handles no installed wallet and restores keyboard focus on Escape', async () => {
    state.connectors=[];mount();
    const trigger=screen.getByRole('button',{name:'Connect wallet'});trigger.focus();fireEvent.click(trigger);
    expect(await screen.findByText(/No browser wallet detected/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
