import type { AvatarComponent } from '@rainbow-me/rainbowkit';

export const WalletAvatar: AvatarComponent = ({ size }) => {
  return <div aria-hidden="true" style={{
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'linear-gradient(155deg, #e3ccff 0%, #b47af0 50%, #7d3fc1 100%)',
  }} />;
};
