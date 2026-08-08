import Link from "next/link";

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  busca,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  busca?: string;
}) {
  if (totalPaginas <= 1) {
    return (
      <p className="px-4 py-3 text-xs text-slate-500">
        {total} registro{total === 1 ? "" : "s"}
      </p>
    );
  }

  function href(p: number) {
    const q = new URLSearchParams();
    q.set("pagina", String(p));
    if (busca) q.set("busca", busca);
    return `?${q.toString()}`;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
      <p className="text-xs text-slate-500">
        Página {pagina} de {totalPaginas} · {total} registro
        {total === 1 ? "" : "s"}
      </p>
      <div className="flex gap-2">
        {pagina > 1 && (
          <Link
            href={href(pagina - 1)}
            className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link
            href={href(pagina + 1)}
            className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            Próxima
          </Link>
        )}
      </div>
    </div>
  );
}

export function BarraBusca({
  placeholder,
  valor,
  name = "q",
}: {
  placeholder: string;
  valor?: string;
  name?: string;
}) {
  return (
    <form className="border-b border-slate-200 p-4 dark:border-slate-800">
      <input
        type="search"
        name={name}
        defaultValue={valor ?? ""}
        placeholder={placeholder}
        className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      />
    </form>
  );
}
