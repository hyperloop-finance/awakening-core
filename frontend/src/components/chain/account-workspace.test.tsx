import {render,screen,fireEvent} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {AccountWorkspace,type AccountWorkspaceProps} from './account-workspace';
import {deployment} from '@/lib/contracts/generated';
const id=deployment.markets[0].id;
const props:AccountWorkspaceProps={page:'positions',wallet:deployment.deployer,canSign:true,busy:false,loading:false,error:'',markets:[{...deployment.markets[0],totalUnits:'800000000',withdrawable:'100000000',tickSpacing:'4'}],orders:[],account:{chainId:97,account:deployment.deployer,observedBlock:123,positions:[{marketId:id,credit:'300000000',debt:'500000000',collateral:'1250000',pendingFee:'0'}],loans:[{loanId:`0x${'1'.repeat(64)}`,marketId:id,borrower:deployment.deployer,principal:'500000000',lastRepaid:'0',collateral:'1250000',premium:'0',expiry:'1793534400',pat:deployment.contracts.AttestedPAT,patTokenId:'5',claimablePutProceeds:'0'},{loanId:`0x${'2'.repeat(64)}`,marketId:id,borrower:deployment.deployer,principal:'100000000',lastRepaid:'100000000',collateral:'0',premium:'0',expiry:'1793534400',pat:deployment.contracts.AttestedPAT,patTokenId:'4',claimablePutProceeds:'20000000'}],pendingTakes:[]},onRefresh:vi.fn(),onConnect:vi.fn(),onPlace:vi.fn(),onCancel:vi.fn(),onSettle:vi.fn()};
it('separates borrow and lend positions with real balances and maturity',()=>{
  render(<AccountWorkspace {...props}/>);
  expect(screen.getByRole('table',{name:'Borrow positions'})).toHaveTextContent('500');
  expect(screen.getByRole('table',{name:'Lend positions'})).toHaveTextContent('300');
  expect(screen.getByText('Repaid')).toBeInTheDocument();
});
it('binds repayment amount to its market and shows actual claim availability',()=>{
  render(<AccountWorkspace {...props} page="settlement"/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Repay amount in USDC'}),{target:{value:'50'}});
  fireEvent.click(screen.getByRole('button',{name:'Repay debt'}));
  expect(props.onSettle).toHaveBeenCalledWith('repay',id,'500000000','50');
  fireEvent.click(screen.getByRole('button',{name:'Claim payout'}));
  expect(props.onSettle).toHaveBeenCalledWith('withdraw',id,'100000000');
  expect(screen.getByRole('button',{name:'Claim residual'})).toBeEnabled();
  expect(screen.queryByRole('button',{name:'Recover collateral'})).not.toBeInTheDocument();
});
it('does not show stale balances or claim actions on RPC failure',()=>{
  render(<AccountWorkspace {...props} page="settlement" error="RPC offline"/>);
  expect(screen.getByRole('alert')).toHaveTextContent('RPC offline');
  expect(screen.queryByRole('button',{name:'Claim payout'})).not.toBeInTheDocument();
});
it('requires a connected wallet and disables all actions for an unsafe runtime',()=>{
  const view=render(<AccountWorkspace {...props} wallet={undefined}/>);
  expect(screen.getByRole('button',{name:'Connect wallet'})).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  view.rerender(<AccountWorkspace {...props} page="settlement" canSign={false}/>);
  expect(screen.getByRole('button',{name:'Repay debt'})).toBeDisabled();
});
it('keeps expired markets out of the new-order form',()=>{
  render(<AccountWorkspace {...props} page="orders" markets={[...props.markets,{...props.markets[0],id:`0x${'3'.repeat(64)}`,market:{...props.markets[0].market,maturity:'1'}}]}/>);
  expect(screen.getAllByRole('option')).toHaveLength(1);
  expect(screen.getByRole('heading',{name:'Place an order'})).toBeInTheDocument();
});
