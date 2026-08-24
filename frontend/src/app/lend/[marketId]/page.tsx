import { LendScreen } from "@/components/lend/lend-screen";
type PageProps = { params: Promise<{ marketId: string }> };
export default async function LendPage({ params }: PageProps) { const { marketId } = await params; return <LendScreen marketId={marketId} side="LEND" />; }
