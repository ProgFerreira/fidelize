export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11) return value;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatPhone(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value;
}

export function isValidCpf(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  return mod === Number(digits[10]);
}
