import { CreditFlow } from "@/components/borrow/borrow-screen";

type PageProps = { params: Promise<{ marketId: string }> };

export default async function BorrowPage({ params }: PageProps) {
  const { marketId } = await params;
  return <CreditFlow marketId={marketId} side="BORROW" />;
}
