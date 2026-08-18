/**
 * Pura, sem dependências — segura pra importar em componente client.
 * Monta um link wa.me: abre o WhatsApp (do médico) com a mensagem pronta
 * pra enviar. Não usa nenhuma API paga, quem manda é o próprio usuário.
 */
export function whatsappDeepLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const comDDI = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(message)}`;
}
