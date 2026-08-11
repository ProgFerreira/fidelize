/** Rótulos em português (pt-BR) para enums e códigos exibidos na UI. */

const LABELS: Record<string, string> = {
  // Status genéricos / paciente / carteira / usuário
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
  CLOSED: "Encerrado",
  DRAFT: "Rascunho",
  SIMULATED: "Simulado",
  CONFIRMED: "Confirmado",
  SCHEDULED: "Agendado",
  ENDED: "Encerrado",
  CANCELLED: "Cancelado",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
  EXPIRED: "Expirado",
  USED: "Utilizado",
  AVAILABLE: "Disponível",
  PENDING: "Pendente",
  COMPLETED: "Concluído",
  REVERSED: "Estornado",
  REPLACED: "Substituído",
  PARTIALLY_USED: "Parcialmente usado",

  // Ledger
  CREDIT_APPOINTMENT: "Crédito de atendimento",
  CREDIT_CAMPAIGN: "Crédito de campanha",
  CREDIT_ADJUSTMENT: "Crédito de ajuste",
  CREDIT_REFERRAL: "Crédito de indicação",
  CREDIT_BIRTHDAY: "Crédito de aniversário",
  CREDIT_AUTOMATION: "Crédito de automação",
  CREDIT_ACCELERATOR: "Crédito de acelerador",
  DEBIT_REDEMPTION: "Resgate de benefício",
  DEBIT_EXPIRATION: "Expiração de saldo",
  DEBIT_REWARD: "Resgate de recompensa",
  DEBIT_VOUCHER: "Uso de cupom",
  GIFT_CARD_ISSUE: "Emissão de vale-presente",
  GIFT_CARD_REDEEM: "Uso de vale-presente",
  VOUCHER_ISSUE: "Emissão de cupom",
  REVERSAL_CREDIT: "Estorno de crédito",
  REVERSAL_REDEMPTION: "Estorno de resgate",
  ADJUSTMENT: "Ajuste",

  // Cartão / lote
  PENDING_PAYMENT: "Pagamento pendente",
  PENDING_FULFILLMENT: "Aguardando entrega",
  FULFILLED: "Entregue",
  RESERVED: "Reservado",

  // Comunicação
  QUEUED: "Na fila",
  SENT: "Enviado",
  DELIVERED: "Entregue",
  READ: "Lido",
  CLICKED: "Clicado",
  FAILED: "Falhou",
  BLOCKED_CONSENT: "Bloqueado por consentimento",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  SMS: "SMS",
  PUSH: "Push",
  INTERNAL: "Interno",

  // Consentimento
  TRANSACTIONAL: "Transacional",
  SERVICE: "Serviço",
  MARKETING: "Marketing",
  SURVEY: "Pesquisa",
  REFERRAL: "Indicação",

  // Automações
  PATIENT_REGISTERED: "Paciente cadastrado",
  FIRST_APPOINTMENT: "Primeiro atendimento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  CASHBACK_RELEASED: "Cashback liberado",
  POINTS_GRANTED: "Pontos concedidos",
  CATEGORY_CHANGED: "Categoria alterada",
  BALANCE_EXPIRING: "Saldo expirando",
  BALANCE_EXPIRED: "Saldo expirado",
  BIRTHDAY: "Aniversário",
  PATIENT_INACTIVE: "Paciente inativo",
  NPS_RESPONDED: "NPS respondido",
  REFERRAL_CREATED: "Indicação criada",
  REFERRAL_CONVERTED: "Indicação convertida",
  VOUCHER_ISSUED: "Cupom emitido",
  VOUCHER_EXPIRING: "Cupom expirando",
  CAMPAIGN_STARTED: "Campanha iniciada",

  // Indicações
  LINK_OPENED: "Link aberto",
  SIGNUP_STARTED: "Cadastro iniciado",
  LEAD: "Lead",
  APPOINTMENT_SCHEDULED: "Agendamento marcado",
  CONVERTED: "Convertido",
  BENEFIT_PENDING: "Benefício pendente",
  BENEFIT_GRANTED: "Benefício concedido",
  REJECTED: "Rejeitado",
  SUSPICIOUS: "Suspeito",

  // Recuperação
  ATTENTION: "Atenção",
  RISK: "Risco",
  RECOVERED: "Recuperado",

  // NPS
  DETRACTOR: "Detrator",
  PASSIVE: "Neutro",
  PROMOTER: "Promotor",

  // Templates
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",

  // Cupons
  FIXED_VALUE: "Valor fixo",
  PERCENT: "Percentual",
  PROCEDURE: "Procedimento",
  GIFT: "Presente",
  COURTESY: "Cortesia",
  FEE: "Taxa",
  RECOVERY: "Recuperação",

  // Ambiente / integração
  test: "Teste",
  live: "Produção",
  inbound: "Entrada",
  outbound: "Saída",

  // Auditoria (ações mais comuns)
  LOGIN: "Login",
  LOGIN_FAILED: "Falha de login",
  LOGOUT: "Logout",
  PATIENT_CREATE: "Criação de paciente",
  PATIENT_UPDATE: "Atualização de paciente",
  RULE_CHANGE: "Alteração de regra",
  CATEGORY_CHANGE: "Alteração de categoria",
  CARD_LINK: "Vínculo de cartão",
  CARD_BLOCK: "Bloqueio de cartão",
  CARD_UNBLOCK: "Desbloqueio de cartão",
  CARD_REPLACE: "Substituição / 2ª via",
  CARD_STOCK: "Geração de estoque de cartões",
  PHYSICAL: "Físico",
  VIRTUAL: "Virtual",
  CREDIT: "Crédito",
  REDEMPTION: "Resgate",
  REVERSAL: "Estorno",
  REPORT_EXPORT: "Exportação de relatório",
  PERMISSION_CHANGE: "Alteração de permissão",
  SETTINGS_CHANGE: "Alteração de configurações",
  OTP_REQUEST: "Solicitação de OTP",
  MODULE_TOGGLE: "Alternância de módulo",
  TAG_ASSIGN: "Atribuição de etiqueta",
  TAG_REMOVE: "Remoção de etiqueta",
  SEGMENT_CHANGE: "Alteração de segmento",
  TEMPLATE_CHANGE: "Alteração de modelo",
  COMMUNICATION_SEND: "Envio de comunicação",
  AUTOMATION_RUN: "Execução de automação",
  AUTOMATION_CHANGE: "Alteração de automação",
  REFERRAL_CREATE: "Criação de indicação",
  REFERRAL_CONVERT: "Conversão de indicação",
  NPS_RESPONSE: "Resposta de NPS",
  REWARD_REDEEM: "Resgate de recompensa",
  VOUCHER_REDEEM: "Resgate de cupom",
  GIFT_CARD: "Vale-presente",
  CONSENT_CHANGE: "Alteração de consentimento",
  ACCELERATOR_CHANGE: "Alteração de acelerador",
  API_KEY_CHANGE: "Alteração de chave de API",
  WEBHOOK_DELIVERY: "Entrega de webhook",
  ONBOARDING_STEP: "Etapa de implantação",
  OTHER: "Outro",

  // Papéis
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  RECEPTION: "Recepção",
  MANAGER: "Gestor",
  SUPPORT: "Suporte",

  // Checklist de publicação
  regulation: "Regulamento",
  financialRules: "Regras financeiras",
  identity: "Identidade da clínica",
  authorizedUsers: "Usuários autorizados",
  communicationChannel: "Canal de comunicação",
  eligibleProcedures: "Procedimentos elegíveis",
  reversalTested: "Estorno testado",
};

export function labelPt(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return LABELS[value] ?? value;
}
