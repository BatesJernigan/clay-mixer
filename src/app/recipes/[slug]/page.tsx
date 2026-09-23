import { notFound } from "next/navigation";
import { presetCollections } from "@/lib/presetMixes";
import { RecipeCollectionView } from "@/components/RecipeCollectionView";

export function generateStaticParams() {
  return presetCollections.map((collection) => ({ slug: collection.slug }));
}

export default async function RecipeCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = presetCollections.find((c) => c.slug === slug);
  if (!collection) notFound();

  return <RecipeCollectionView collection={collection} />;
}
