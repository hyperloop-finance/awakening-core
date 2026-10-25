import {assetPath} from '@/lib/networks';
import Image from "next/image";

const venues = ["Deribit", "Deribit", "Derive"] as const;

export function OptionVenue({ marketIndex }: { marketIndex: number }) {
  const name = venues[marketIndex];
  if (!name) return <span>—</span>;

  return (
    <span className="option-venue">
      <Image src={assetPath(`/venues/${name.toLowerCase()}.png`)} alt="" width={22} height={22} />
      <span>{name}</span>
    </span>
  );
}
