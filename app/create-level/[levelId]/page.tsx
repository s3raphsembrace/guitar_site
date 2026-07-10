import { redirect } from "next/navigation";

export default async function LevelRoute({
  params,
}: {
  params: Promise<{ levelId: string }>;
}) {
  const { levelId } = await params;
  redirect(`/create-level/${levelId}/edit`);
}
