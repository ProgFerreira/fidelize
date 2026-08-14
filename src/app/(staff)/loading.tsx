import { SkeletonTabela } from "@/components/ui";

export default function StaffLoading() {
  return <SkeletonTabela linhas={8} colunas={5} />;
}
