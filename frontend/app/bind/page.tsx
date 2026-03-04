import BindPanel from "../ui/bind";

type BindPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BindPage({ searchParams }: BindPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sourceValue = resolvedSearchParams.source;
  const source = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue;

  return <BindPanel source={source} />;
}
