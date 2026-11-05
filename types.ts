export enum UserRole {
  OWNER = 'OWNER',
  SUPERVISOR = 'SUPERVISOR',
  ADMIN = 'ADMINISTRATIVO',
  ADMIN_ALT = 'ADMINISTRADOR',
  VENDEDOR = 'VENDEDOR',
  ADVOGADO = 'ADVOGADO'
}

export enum UserStatus {
  ACTIVE = 'ATIVO',
  PENDING = 'PENDENTE',
  BLOCKED = 'BLOQUEADO'
}

export enum LeadStatus {
  ENTRAR_CONTATO = 'Entrar em Contato',
  ENVIADO_TIM = 'Enviado TIM',
  ENVIADO_ALIVE = 'Enviado Alive',
  NEGOCIANDO = 'Negociando',
  RENOVADO = 'Renovado',
  FECHADO = 'Fechado',
  SEM_INTERESSE = 'Sem Interesse',
  // Status Pós-Venda (Vendas Novas)
  COLETA_ASSINATURA = 'Coleta de Assinatura',
  CONFIRMACAO_TELEFONICA = 'Confirmacão Telefônica',
  EM_ANALISE = 'Em Análise',
  VALIDANDO = 'Validando',
  VALIDANDO_PORTABILIDADE = 'Validando Portabilidade',
  REPROVADO = 'Reprovado',
  CANCELADO = 'Cancelado',
  ESTORNADO = 'Estornado',
  CORRECAO_CONSULTOR = 'Correção do Consultor',
  FINALIZADO = 'Finalizado',
  RENOVAR = 'Renovar',
  // Status Específicos de Renovação
  R_ASSINATURA = 'R- Assinatura contrato',
  R_CONFIRMACAO = 'R- Confirmação telefônica',
  R_ANALISE = 'R- Em análise',
  R_VALIDANDO = 'R- Validando',
  R_FECHADO = 'R- Fechado'
}

export enum TicketStatus {
  ABERTO = 'ABERTO',
  FINALIZADO = 'FINALIZADO',
  REABERTO = 'NOVO PRAZO'
}

export interface Ticket {
  id: string;
  leadId: string;
  razaoSocial: string;
  cnpj: string;
  requesterId: string;
  requesterName: string;
  login?: string;
  password?: string;
  description: string;
  selectedLines: string[];
  status: TicketStatus;
  createdAt: string;
  deadlineAt: string;
  notes: TicketNote[];
  attachments?: Attachment[];
}

export interface TicketNote {
  id: string;
  userName: string;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}

export enum GoalTargetType {
  VALOR = 'Valor (R$)',
  QUANTIDADE = 'Quantidade'
}

export enum ChipStatus {
  MATURANDO = 'MATURANDO',
  BANIDO = 'BANIDO',
  ATIVO = 'ATIVO',
  CANCELADO = 'CANCELADO'
}

export interface ChipLine {
  id: string;
  status: ChipStatus;
  number: string;
  name: string;
  vendedor: string;
}

export interface ChipDevice {
  id: string;
  name: string;
  lines: ChipLine[];
}

export interface Goal {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  targetType: GoalTargetType;
  objective: number;
  assignedTo: string;
  currentProgress: number;
  isCompleted: boolean;
}

export interface ProposalItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  unitValue: number;
}

export interface ContractItem {
  id: string;
  type: 'Apar' | 'Pacc';
  description: string;
  qty: number;
  monthlyPrice: number;
  devicePrice: number;
}

export interface ProposalSettings {
  logo?: string;
  prestadoraName: string;
  contatoEmail: string;
  contatoSite: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  birthDate?: string;
  phone?: string;
  avatar?: string;
  password?: string;
  department?: string;
  createdAt?: string;
  admissionDate?: string;
}

export interface PunchRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  date: string; // YYYY-MM-DD
  entry?: string;
  lunchStart?: string;
  lunchReturn?: string;
  exit?: string;
  morningBreakStart?: string;
  morningBreakEnd?: string;
  afternoonBreakStart?: string;
  afternoonBreakEnd?: string;
  status: 'Presente' | 'Ausente' | 'Almoço' | 'Pausa' | 'Finalizado';
  justificationReason?: string;
  hasMedicalCertificate?: boolean;
  medicalCertificateAttachment?: Attachment;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: string;
  createdAt: string;
}

export interface LineDetail {
  telefone: string;
  plano: string;
  valor: number;
  idLinha: string;
  aging: string;
  conta: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  userName: string;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Lead {
  id: string;
  ELEMENTO: string;
  CNPJ: string;
  razaoSocial: string;
  estado: string;
  DATA_Consulta: string;
  Status: LeadStatus;
  Vendedor: string;
  Telefone_Principal: string;
  operadora: string;
  ATIVOS: string;
  DATA_ULTIMO_PEDIDO_NA_VIVO: string;
  primaryContactIndex?: number;
  // Origem dos dados
  isFromClosedTable?: boolean;
  // Detailed fields
  pen: string;
  vozBasica: string;
  dados: string;
  NOME: string;
  CPF: string;
  RG: string;
  CELULAR: string;
  EMAIL: string;
  // Contact persons
  NOME_02: string; CPF_02: string; RG_02: string; CELULAR_02: string; EMAIL_02: string;
  NOME_03: string; CPF_03: string; RG_03: string; CELULAR_03: string; EMAIL_03: string;
  NOME_04: string; CPF_04: string; RG_04: string; CELULAR_04: string; EMAIL_04: string;
  NOME_05: string; CPF_05: string; RG_05: string; CELULAR_05: string; EMAIL_05: string;
  // VIVO info (Legado/Financeiro)
  RETORNO_CREDITO_VIVO: string;
  VALOR_EM_ABERTO_VIVO: string;
  VALOR_TOTAL_DEBITO_VIVO: string;
  N_ULTIMO_PEDIDO_NA_VIVO: string;
  STATUS_PEDIDO_VIVO: string;
  // Novos Campos Informações do Pedido
  custCode?: string;
  login?: string;
  senha?: string;
  radar?: string;
  tokenCadastro?: string;
  dataRenovacao?: string;
  // New Fields for Lines
  linhasDetalhas?: LineDetail[];
  valorTotalReceita?: number;
  // Campos Clientes Fechados
  dataFechamento?: string;
  dataPortabilidade?: string;
  isPago?: boolean;
  isPortado?: boolean;
  // Anexos e Notas
  attachments?: Attachment[];
  notes?: LeadNote[];
}

export interface Activity {
  id: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  toolId: string;
  toolName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  expiresAt?: string;
}

