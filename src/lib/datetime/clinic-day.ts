/** Data civil YYYY-MM-DD no fuso da clínica. */
export function todayYmd(timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseYmd(raw: string | null | undefined) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function offsetMsAt(utcMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return utcMs - asUtc;
}

/** Início e fim do dia civil no fuso informado. */
export function clinicDayBounds(
  ymd: string,
  timeZone = "America/Sao_Paulo",
) {
  const [y, m, d] = ymd.split("-").map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const offset = offsetMsAt(noonUtc, timeZone);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offset);
  const next = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) + offset);
  return { start, end: new Date(next.getTime() - 1) };
}

export function formatYmdPt(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Início do dia `fromYmd` até o fim do dia `toYmd` no fuso da clínica. */
export function clinicRangeBounds(
  fromYmd: string,
  toYmd: string,
  timeZone = "America/Sao_Paulo",
) {
  const from = fromYmd <= toYmd ? fromYmd : toYmd;
  const to = fromYmd <= toYmd ? toYmd : fromYmd;
  const start = clinicDayBounds(from, timeZone).start;
  const end = clinicDayBounds(to, timeZone).end;
  return { start, end, fromYmd: from, toYmd: to };
}

const MAX_RANGE_DAYS = 93;

export function resolveExtractPeriod(input: {
  data?: string | null;
  de?: string | null;
  ate?: string | null;
  todayYmd: string;
}) {
  const today = input.todayYmd;
  const single = parseYmd(input.data);
  let from = parseYmd(input.de) ?? single ?? today;
  let to = parseYmd(input.ate) ?? single ?? from;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  const days = Math.floor((toTime - fromTime) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    const capped = new Date(fromTime + (MAX_RANGE_DAYS - 1) * 86_400_000);
    to = capped.toISOString().slice(0, 10);
  }
  return { fromYmd: from, toYmd: to, isRange: from !== to };
}
