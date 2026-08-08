Amplie a aplicação “Clube de Benefícios Clínica Dermaphios” criada anteriormente.

Não recrie o projeto, não substitua a arquitetura existente e não remova funcionalidades já implementadas. Acrescente os módulos abaixo à aplicação atual, reutilizando autenticação, pacientes, clínicas, unidades, carteiras, campanhas, cashback, pontos, categorias, auditoria e livro de transações.

Mantenha a stack:

- Next.js 16.2 LTS;
- React 19.2;
- TypeScript 5.9 strict;
- Node.js 22 LTS;
- MySQL 8.4 com InnoDB e utf8mb4;
- Prisma ORM 7;
- Auth.js/NextAuth;
- Tailwind CSS 4.3;
- React Hook Form;
- Zod;
- Lucide React;
- Recharts;
- Vitest e Playwright.

Não copie nomes, textos, identidade visual, código, telas ou materiais de concorrentes. Implemente apenas conceitos funcionais comuns a plataformas de fidelidade, adaptados à identidade da Clínica Dermaphios.

## 1. Sistema modular

Crie uma central chamada “Módulos do programa”.

O administrador poderá ativar ou desativar separadamente:

- Cashback;
- Pontos;
- Categorias;
- Indicação;
- Catálogo de recompensas;
- Vouchers;
- Vale-presente;
- NPS;
- Aniversário;
- Automações;
- WhatsApp;
- E-mail;
- SMS;
- Notificações push;
- Aceleradores;
- Sorteios;
- Recebimento de comprovantes;
- Inteligência preditiva.

Desativar um módulo deve ocultar suas interfaces e interromper novos processamentos, sem apagar dados históricos.

Registrar na auditoria toda ativação, desativação ou alteração de configuração.

## 2. Assistente de implantação

Criar um onboarding administrativo em etapas:

1. Dados e identidade da clínica;
2. Cadastro das unidades;
3. Importação de pacientes;
4. Escolha entre cashback, pontos ou ambos;
5. Configuração das categorias;
6. Definição de validade e limites;
7. Configuração das comunicações;
8. Criação da primeira campanha;
9. Convite aos funcionários;
10. Simulação de uma operação;
11. Checklist de publicação.

Exibir percentual de conclusão e pendências.

Antes de ativar o programa em produção, validar:

- Regulamento publicado;
- Regras financeiras configuradas;
- Identidade visual;
- Usuários autorizados;
- Canal de comunicação;
- Procedimentos elegíveis;
- Operação de estorno testada.

## 3. CRM e etiquetas de pacientes

Adicionar etiquetas manuais e automáticas.

Exemplos:

- Novo paciente;
- Primeira visita;
- Frequente;
- VIP;
- Alto ticket;
- Aniversariante;
- Saldo próximo de expirar;
- Sem retorno há 30 dias;
- Sem retorno há 60 dias;
- Sem retorno há 90 dias;
- Promotor;
- Neutro;
- Detrator;
- Indicado;
- Indicador;
- Interesse em procedimento;
- Não deseja receber marketing.

Permitir:

- Criar etiquetas personalizadas;
- Definir cores;
- Aplicar etiquetas em lote;
- Criar regras de aplicação automática;
- Filtrar pacientes pela combinação de etiquetas;
- Utilizar etiquetas em campanhas;
- Registrar origem e data da etiqueta;
- Remover etiquetas automáticas quando a condição deixar de existir.

Não armazenar informações médicas ou diagnósticos nas etiquetas.

## 4. Segmentos dinâmicos

Criar um construtor de segmentos com filtros combináveis:

- Clínica e unidade;
- Categoria;
- Etiqueta;
- Idade;
- Mês de aniversário;
- Data do último atendimento;
- Quantidade de atendimentos;
- Valor total gasto;
- Ticket médio;
- Saldo disponível;
- Saldo próximo de expirar;
- Pontos;
- Procedimentos realizados;
- Origem do cadastro;
- Participação em campanha;
- Resultado de NPS;
- Permissão de marketing;
- Canal de comunicação válido.

Permitir salvar o segmento para reutilização.

O segmento deverá ser dinâmico: novos pacientes entram ou saem automaticamente conforme as condições.

Antes de um disparo, mostrar:

- Quantidade estimada de destinatários;
- Pacientes sem consentimento;
- Telefones ou e-mails inválidos;
- Pacientes bloqueados;
- Custo estimado;
- Valor total de benefícios oferecidos.

## 5. Automações de relacionamento

Criar um motor de automação baseado em gatilho, condição e ação.

### Gatilhos

- Paciente cadastrado;
- Primeiro atendimento;
- Pagamento confirmado;
- Cashback liberado;
- Pontos concedidos;
- Mudança de categoria;
- Saldo próximo de expirar;
- Saldo expirado;
- Aniversário;
- Paciente sem retorno por determinado período;
- NPS respondido;
- Indicação cadastrada;
- Indicação convertida;
- Voucher emitido;
- Voucher próximo de vencer;
- Campanha iniciada;
- Data e horário programados.

### Condições

- Unidade;
- Categoria;
- Etiqueta;
- Valor do atendimento;
- Procedimento;
- Saldo;
- Pontos;
- Número de visitas;
- Tempo desde a última visita;
- Consentimento;
- Canal disponível;
- Horário permitido;
- Paciente já ter ou não recebido a automação.

### Ações

- Enviar WhatsApp;
- Enviar e-mail;
- Enviar SMS;
- Criar notificação interna;
- Conceder cashback;
- Conceder pontos;
- Emitir voucher;
- Aplicar etiqueta;
- Remover etiqueta;
- Criar tarefa para a recepção;
- Aguardar determinado período;
- Encerrar fluxo.

Criar modelos iniciais:

- Boas-vindas;
- Aviso de cashback recebido;
- Aviso de pontos recebidos;
- Mudança de categoria;
- Saldo vencendo;
- Aniversário;
- Paciente ausente há 30 dias;
- Paciente ausente há 60 dias;
- Pós-atendimento;
- Pesquisa de satisfação;
- Indicação convertida;
- Voucher próximo de vencer.

Permitir pausar, duplicar, editar, testar e versionar automações.

Impedir que uma automação gere créditos repetidos quando for reprocessada.

## 6. Central de comunicações

Criar uma central unificada para:

- WhatsApp;
- E-mail;
- SMS;
- Push;
- Notificação interna.

Cada mensagem deverá registrar:

- Paciente;
- Canal;
- Template;
- Campanha ou automação;
- Data de criação;
- Data de envio;
- Status;
- Identificador no provedor;
- Entrega;
- Leitura, quando disponível;
- Clique, quando disponível;
- Erro;
- Motivo do erro;
- Opt-out;
- Custo estimado.

Status:

- Rascunho;
- Agendada;
- Na fila;
- Enviada;
- Entregue;
- Lida;
- Clicada;
- Falhou;
- Cancelada;
- Bloqueada por consentimento.

Implementar fila, repetição controlada e prevenção de envio duplicado.

Permitir mensagem de teste antes de campanhas em massa.

Respeitar janela de horário configurável e limite de mensagens por paciente.

## 7. Templates de mensagens

Criar editor de templates com variáveis seguras:

- Nome do paciente;
- Nome da clínica;
- Unidade;
- Saldo;
- Pontos;
- Categoria;
- Validade;
- Nome da campanha;
- Nome do voucher;
- Link do portal;
- Link de indicação;
- Link da pesquisa;
- Telefone da clínica.

Adicionar:

- Pré-visualização;
- Contagem de caracteres;
- Validação de variáveis;
- Versões;
- Aprovação administrativa;
- Canal compatível;
- Idioma;
- Rodapé de descadastro quando necessário.

Nunca permitir que uma variável exponha CPF completo, dados médicos, senha ou informações sensíveis.

## 8. Programa de indicação

Criar um programa completo de indicação “Paciente indica paciente”.

Cada paciente deverá possuir:

- Link de indicação único;
- Código curto;
- QR Code de indicação;
- Tela para compartilhar pelo WhatsApp.

Fluxo:

1. Paciente compartilha o link;
2. Novo interessado abre uma página personalizada;
3. Informa nome, telefone e consentimento;
4. Sistema registra o indicador;
5. Interessado passa a ter status de lead indicado;
6. Quando realizar o primeiro atendimento elegível, a indicação é convertida;
7. O sistema concede os benefícios configurados;
8. Indicador e indicado recebem confirmação.

Permitir configurar:

- Benefício para quem indica;
- Benefício para quem foi indicado;
- Evento que confirma a conversão;
- Valor mínimo do primeiro atendimento;
- Procedimentos participantes;
- Prazo para conversão;
- Limite por paciente e período;
- Unidade;
- Campanha;
- Validade do benefício.

Status:

- Link acessado;
- Cadastro iniciado;
- Lead cadastrado;
- Atendimento agendado;
- Convertido;
- Benefício pendente;
- Benefício concedido;
- Rejeitado;
- Expirado;
- Suspeito.

Criar proteção contra fraude:

- Autoindicação;
- CPF repetido;
- Telefone repetido;
- Múltiplos cadastros;
- Indicação posterior ao cadastro;
- Conversão duplicada;
- Excesso de indicações em curto período.

Criar um funil de indicação no dashboard.

## 9. NPS e satisfação

Criar pesquisas automáticas após o atendimento.

A pesquisa principal deverá perguntar, em uma escala de 0 a 10, a probabilidade de o paciente recomendar a clínica.

Classificar:

- 0 a 6: detrator;
- 7 a 8: neutro;
- 9 a 10: promotor.

Permitir:

- Comentário opcional;
- Perguntas adicionais;
- Pesquisa por procedimento ou unidade;
- Link único de resposta;
- Uma resposta por atendimento;
- Prazo de validade;
- Disparo automático;
- Histórico do paciente.

Fluxos:

- Promotor: agradecer e oferecer link de indicação;
- Neutro: solicitar sugestão;
- Detrator: criar alerta privado e tarefa de recuperação.

Não publicar automaticamente avaliações negativas ou positivas.

Dashboard de NPS:

- NPS geral;
- Evolução mensal;
- NPS por unidade;
- NPS por profissional;
- NPS por procedimento;
- Taxa de resposta;
- Motivos recorrentes;
- Casos pendentes de recuperação.

## 10. Catálogo de recompensas

Criar um catálogo no qual pontos possam ser trocados por:

- Produtos;
- Serviços;
- Cortesias;
- Descontos;
- Experiências;
- Vouchers.

Cada recompensa deverá conter:

- Nome;
- Descrição;
- Imagem;
- Quantidade de pontos;
- Categoria mínima;
- Estoque;
- Limite por paciente;
- Período de disponibilidade;
- Unidades participantes;
- Regras;
- Situação.

Fluxo de resgate:

1. Paciente escolhe a recompensa;
2. Sistema valida pontos, estoque e elegibilidade;
3. Exibe confirmação;
4. Reserva a recompensa;
5. Debita os pontos;
6. Emite código de resgate;
7. Recepção confirma a entrega;
8. Sistema registra data, local e responsável.

Utilizar transação no MySQL para impedir resgate duplicado ou estoque negativo.

## 11. Vouchers e cupons rastreáveis

Criar vouchers com código único e QR Code.

Tipos:

- Valor fixo;
- Percentual;
- Procedimento específico;
- Brinde;
- Cortesia;
- Frete ou taxa, caso aplicável;
- Recuperação de experiência negativa;
- Campanha de aniversário.

Configurações:

- Quantidade;
- Validade;
- Limite de uso;
- Uso único ou múltiplo;
- Paciente específico ou público;
- Unidade;
- Procedimento;
- Valor mínimo;
- Horários permitidos;
- Combinação com cashback;
- Combinação com desconto;
- Status.

Registrar emissão, envio, visualização, tentativa de uso, resgate, cancelamento e expiração.

## 12. Vale-presente

Criar módulo de vale-presente digital.

Permitir:

- Comprador e beneficiário diferentes;
- Mensagem personalizada;
- Valor definido ou opções predefinidas;
- Código único;
- QR Code;
- Data de envio;
- Validade;
- Uso parcial, quando permitido;
- Extrato de utilizações;
- Cancelamento conforme regras administrativas.

O pagamento do vale-presente deverá ser tratado separadamente do saldo promocional.

Não considerar o vale-presente como cashback.

Criar contas contábeis lógicas separadas no livro de transações para:

- Benefício promocional;
- Pontos;
- Voucher;
- Vale-presente pré-pago.

## 13. Aceleradores

Criar regras temporárias de multiplicação de pontos ou cashback.

Exemplos:

- Pontos em dobro;
- Pontos em triplo;
- Cashback adicional;
- Bônus fixo;
- Benefício em dias de baixa demanda;
- Benefício em horário específico;
- Benefício para procedimento selecionado;
- Benefício exclusivo para determinada categoria.

Configurar:

- Vigência;
- Dias da semana;
- Horários;
- Procedimentos;
- Unidades;
- Categorias;
- Limite por paciente;
- Limite financeiro total;
- Prioridade;
- Regras de combinação.

Antes de ativar, mostrar uma estimativa do custo promocional máximo.

## 14. Aniversário do paciente

Criar automação específica de aniversário.

Permitir configurar:

- Dia, semana ou mês de envio;
- Canal;
- Mensagem;
- Pontos;
- Cashback;
- Voucher;
- Brinde;
- Validade;
- Limite de uso;
- Procedimentos elegíveis;
- Necessidade de atendimento mínimo.

Impedir concessão duplicada no mesmo ano.

## 15. Recuperação de pacientes inativos

Criar classificação automática de inatividade:

- Atenção;
- Risco;
- Inativo;
- Recuperado.

Os períodos deverão ser configuráveis por clínica e, opcionalmente, por tipo de procedimento.

Criar réguas de recuperação com:

- Mensagem inicial;
- Espera;
- Lembrete;
- Benefício opcional;
- Tarefa para recepção;
- Encerramento após retorno.

Quando o paciente realizar novo atendimento, interromper automaticamente as mensagens e marcar a recuperação.

## 16. Mensuração de campanhas

Além de enviados, entregues e cliques, medir:

- Pacientes impactados;
- Pacientes que retornaram;
- Tempo médio até o retorno;
- Atendimentos atribuídos;
- Receita atribuída;
- Benefícios concedidos;
- Benefícios utilizados;
- Custo de comunicação;
- Custo promocional;
- Receita líquida estimada;
- ROI;
- Conversão;
- Grupo de controle opcional.

Definir uma janela de atribuição configurável.

Não atribuir o mesmo atendimento integralmente a múltiplas campanhas. Definir uma regra de prioridade ou atribuição principal.

## 17. Indicadores adicionais

Adicionar ao dashboard:

- LTV estimado;
- Frequência média;
- Intervalo médio entre atendimentos;
- Pacientes recorrentes;
- Pacientes de primeira compra;
- Pacientes ociosos;
- Taxa de recuperação;
- Taxa de indicação;
- Conversão de indicados;
- Custo promocional;
- Receita por campanha;
- NPS;
- Taxa de resposta;
- Saldo médio por paciente;
- Saldo que vence em 7, 15 e 30 dias;
- Recompensas mais resgatadas;
- Eficiência por canal.

Permitir comparação entre períodos e unidades.

## 18. Portal personalizado

Preparar o portal para domínio personalizado, por exemplo:

`beneficios.clinicadermaphios.com.br`

O portal deverá oferecer:

- Saldo;
- Pontos;
- Extrato;
- Cartão digital;
- Categoria;
- Progresso;
- Recompensas;
- Vouchers;
- Indicações;
- Pesquisa NPS;
- Histórico de visitas comerciais;
- Preferências de comunicação;
- Contato da clínica.

Não exibir dados assistenciais ou informações do prontuário.

## 19. Integrações robustas

Ampliar a API e os webhooks.

Criar endpoints versionados para:

- Pacientes;
- Atendimentos;
- Pagamentos;
- Cancelamentos;
- Procedimentos;
- Créditos;
- Resgates;
- Saldo;
- Pontos;
- Vouchers;
- Indicações;
- NPS.

Implementar:

- Chave de idempotência;
- Assinatura de webhook;
- Timestamp;
- Proteção contra repetição;
- Tentativas automáticas;
- Fila de falhas;
- Reprocessamento manual;
- Logs de requisição;
- Limite de uso;
- Chaves por clínica;
- Rotação e revogação de chaves;
- Ambiente de teste;
- Documentação OpenAPI.

Nunca registrar senhas, tokens completos ou dados sensíveis nos logs.

## 20. Consentimento e preferência de comunicação

Criar uma central de consentimento contendo:

- Canal;
- Finalidade;
- Origem;
- Data;
- Texto aceito;
- Versão do texto;
- Endereço IP quando juridicamente apropriado;
- Revogação;
- Data da revogação.

Separar:

- Mensagens transacionais;
- Mensagens de serviço;
- Marketing;
- Pesquisas;
- Indicações.

Permitir descadastro por canal.

Bloquear campanhas de marketing para pacientes sem consentimento válido.

## 21. Novas entidades do banco

Adicionar ao modelo Prisma, conforme necessário:

- FeatureModule;
- ModuleConfiguration;
- OnboardingChecklist;
- CustomerTag;
- CustomerTagAssignment;
- DynamicSegment;
- SegmentRule;
- Automation;
- AutomationVersion;
- AutomationStep;
- AutomationExecution;
- AutomationActionExecution;
- MessageTemplate;
- Communication;
- CommunicationEvent;
- CommunicationPreference;
- ConsentRecord;
- ReferralProgram;
- Referral;
- SatisfactionSurvey;
- SurveyResponse;
- RecoveryCase;
- Reward;
- RewardStock;
- RewardRedemption;
- Voucher;
- VoucherRedemption;
- GiftCard;
- GiftCardTransaction;
- AcceleratorRule;
- CampaignAttribution;
- ApiCredential;
- WebhookEndpoint;
- WebhookDelivery;
- IntegrationLog.

Todas as entidades devem possuir `clinicId` quando aplicável.

Criar índices compostos adequados para clínica, paciente, status e datas.

## 22. Recursos para fases futuras

Preparar contratos e pontos de extensão, mas não implementar no MVP:

- Aplicativos nativos white label;
- Push notification nativo;
- Leitura de comprovante ou nota por OCR;
- Análise antifraude de comprovantes;
- Widget incorporável em outros sites;
- Extensão para navegador;
- Sorteios;
- Inteligência preditiva;
- Previsão de faturamento;
- Pontuação de risco de abandono.

Não apresentar esses recursos como concluídos.

Criar apenas documentação técnica indicando onde poderão ser integrados futuramente.

## 23. Priorização

Implementar nesta ordem:

### Etapa 1

- Módulos;
- Etiquetas;
- Segmentos;
- Central de consentimento;
- Templates;
- Logs de comunicação.

### Etapa 2

- Motor de automação;
- Aniversário;
- Saldo próximo de expirar;
- Recuperação de inativos.

### Etapa 3

- Indicação;
- NPS;
- Funil de recuperação;
- Métricas.

### Etapa 4

- Catálogo de recompensas;
- Vouchers;
- Vale-presente;
- Aceleradores.

### Etapa 5

- API ampliada;
- Webhooks;
- Atribuição de campanhas;
- Dashboard avançado.

## 24. Critérios de aceitação

A ampliação será considerada funcional quando:

- O administrador puder ativar e desativar módulos;
- Etiquetas automáticas forem atualizadas corretamente;
- Segmentos dinâmicos refletirem os dados atuais;
- Uma automação puder ser disparada sem duplicidade;
- Consentimentos forem respeitados;
- Mensagens tiverem histórico de entrega;
- Uma indicação puder ser rastreada até a conversão;
- Autoindicação e conversão duplicada forem bloqueadas;
- Uma resposta NPS gerar a classificação correta;
- Um detrator gerar tarefa privada de recuperação;
- Pontos puderem ser trocados por recompensa;
- Estoque e pontos não ficarem negativos;
- Vouchers tiverem código único e uso rastreável;
- Benefício de aniversário não for concedido duas vezes no ano;
- Paciente recuperado sair automaticamente da régua de inatividade;
- Campanhas apresentarem receita, custo e ROI;
- Webhooks puderem ser repetidos sem duplicar operações;
- Todas as ações sensíveis aparecerem na auditoria;
- Os testes automatizados cobrirem concorrência, duplicidade, estorno, expiração, indicação e resgate.

Antes de começar a implementação, apresente:

1. Diferenças entre o sistema atual e os novos módulos;
2. Alterações necessárias no banco;
3. Novas páginas;
4. Novas permissões;
5. Fluxos das automações;
6. Plano de migração sem perda de dados;
7. Riscos técnicos;
8. Estimativa por etapa.

Aguarde aprovação dessa análise antes de modificar a aplicação.