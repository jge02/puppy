import BindPanel from "../../features/bind/BindPanel";

type BindPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BindPage({ searchParams }: BindPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sourceValue = resolvedSearchParams.source;
  const tabValue = resolvedSearchParams.tab;
  const source = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue;
  const tab = Array.isArray(tabValue) ? tabValue[0] : tabValue;

  return <BindPanel source={source} tab={tab} />;
}
