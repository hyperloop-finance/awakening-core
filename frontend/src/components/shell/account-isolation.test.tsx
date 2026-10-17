import { useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccountBoundary } from './account-boundary';
const identity=vi.hoisted(()=>({wallet:undefined as string|undefined,chainId:97,openWallet:vi.fn()}));
vi.mock('./wallet',()=>({useWalletIdentity:()=>identity}));
beforeEach(()=>{identity.wallet=undefined;identity.chainId=97;vi.clearAllMocks();});
it('does not mount account data or simulation actions even after wallet connection',()=>{
  const mounted=vi.fn();function DangerousPreview(){useEffect(mounted,[]);return <button>Repay simulated debt</button>;}
  const view=render(<AccountBoundary pathname="/settlement"><DangerousPreview/></AccountBoundary>);
  fireEvent.click(screen.getByRole('button',{name:'Connect wallet'}));
  expect(identity.openWallet).toHaveBeenCalledOnce();
  identity.wallet='0x1111111111111111111111111111111111111111';
  view.rerender(<AccountBoundary pathname="/settlement"><DangerousPreview/></AccountBoundary>);
  expect(screen.getByText('Testnet integration not ready')).toBeInTheDocument();
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByText('Repay simulated debt')).not.toBeInTheDocument();
});
it('remounts public previews across accounts and ignores late old-account results',async()=>{
  const responses:Record<string,(s:string)=>void>={};
  function Preview(){const [result,setResult]=useState('loading');useEffect(()=>{let active=true;const wallet=identity.wallet??'none';new Promise<string>(resolve=>{responses[wallet]=resolve;}).then(v=>{if(active)setResult(v);});return()=>{active=false;};},[]);return <p>{result}</p>;}
  identity.wallet='A';const view=render(<AccountBoundary pathname="/markets"><Preview/></AccountBoundary>);
  identity.wallet='B';view.rerender(<AccountBoundary pathname="/markets"><Preview/></AccountBoundary>);
  await act(async()=>{responses.B('B result');});
  await act(async()=>{responses.A('A result');});
  expect(screen.getByText('B result')).toBeInTheDocument();
  expect(screen.queryByText('A result')).not.toBeInTheDocument();
  identity.wallet=undefined;view.rerender(<AccountBoundary pathname="/markets"><Preview/></AccountBoundary>);
  expect(screen.queryByText('B result')).not.toBeInTheDocument();
});
