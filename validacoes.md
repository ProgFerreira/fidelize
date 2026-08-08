Regras técnicas obrigatórias
Utilizar MySQL com transações e bloqueio concorrente nas operações de saldo.
Não armazenar o saldo como única fonte da verdade.
Manter um livro de transações para créditos, débitos, expirações e estornos.
Usar DECIMAL(19,4) para valores internos e arredondar conforme a regra monetária.
Nunca usar FLOAT ou DOUBLE para cashback e valores financeiros.
Criar índices compostos incluindo clinicId nas consultas multiclínica.
Impedir duplicidade de CPF por clínica mediante restrição no banco.
Usar chaves de idempotência para pagamentos, créditos, resgates e webhooks.
Não apagar transações; corrigir por estorno.
Validar autorização no servidor e próximo ao acesso ao banco.
Não confiar somente na ocultação de botões ou proteção de rotas.
Registrar datas em UTC e convertê-las para o fuso da clínica na interface.
Manter percentuais, categorias, validade e limites configuráveis.
Implementar testes de concorrência para impedir o resgate duplicado do mesmo saldo.