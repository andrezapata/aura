import { Component, computed, signal } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { demoAdminCredentials } from './demo-credentials';
import { firebaseAuth } from './firebase-auth';

export interface ProcessStep {
  title: string;
  description: string;
  assignee: string;
  status: 'completed' | 'current' | 'upcoming';
  completedAt?: string;
}

export interface OperationalProcess {
  id: string;
  code: string;
  name: string;
  category: string;
  responsible: string;
  responsibleRole: string;
  progress: number;
  status: 'En tiempo' | 'En riesgo' | 'Retrasado' | 'Completado';
  tone: 'green' | 'amber' | 'coral' | 'blue';
  startDate: string;
  dueDate: string;
  currentStepIndex: number;
  steps: ProcessStep[];
}

export interface OperationalTask {
  id: string;
  code: string;
  title: string;
  description: string;
  department: string;
  assignee: string;
  assigneeInitials: string;
  priority: 'Urgente' | 'Alta' | 'Media' | 'Baja';
  priorityTone: 'coral' | 'amber' | 'blue' | 'green';
  status: 'Pendiente' | 'En curso' | 'En revisión' | 'Bloqueada' | 'Completada';
  statusTone: 'amber' | 'blue' | 'purple' | 'coral' | 'green';
  dueDate: string;
}

export interface OperationalLeader {
  id: string;
  code: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  activeTasks: number;
  completionRate: string;
  status: 'Disponible' | 'En operativo' | 'En guardia' | 'En descanso';
  statusTone: 'green' | 'blue' | 'amber' | 'slate';
  initials: string;
}

export interface OperationalRequest {
  id: string;
  code: string;
  title: string;
  category: string;
  requester: string;
  department: string;
  createdAt: string;
  urgency: 'Urgente' | 'Alta' | 'Media';
  urgencyTone: 'coral' | 'amber' | 'blue';
  status: 'Pendiente' | 'En evaluación' | 'Aprobada' | 'Rechazada';
  statusTone: 'amber' | 'blue' | 'green' | 'coral';
  details: string;
}

export interface OperationalApproval {
  id: string;
  code: string;
  subject: string;
  requester: string;
  category: string;
  submissionDate: string;
  deadlineSLA: string;
  costOrImpact: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado';
  statusTone: 'amber' | 'green' | 'coral';
}

export interface OperationalDeadline {
  id: string;
  code: string;
  title: string;
  relatedEntity: string;
  category: string;
  targetDate: string;
  daysRemaining: number;
  urgencyText: string;
  urgencyTone: 'coral' | 'amber' | 'blue' | 'green';
  status: 'Pendiente' | 'Cumplido';
}

export interface CreateField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  step?: string;
  wide?: boolean;
}

interface UserSession {
  name: string;
  email: string;
  role: 'Administrador' | 'Usuario';
}

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly sessionStorageKey = 'aura.session';
  protected readonly currentUser = signal<UserSession | null>(this.readSessionUser());
  protected readonly demoEmail = demoAdminCredentials.email;
  protected readonly demoPassword = demoAdminCredentials.password;
  protected readonly isAuthenticated = computed(() => this.currentUser() !== null);
  protected readonly authMode = signal<'login' | 'register'>('login');
  protected readonly authMessage = signal('');
  protected readonly isSigningOut = signal(false);
  protected readonly isProfileMenuOpen = signal(false);
  protected readonly isProfileDetailsOpen = signal(false);
  protected readonly activeNav = signal('Resumen');
  protected readonly searchTerm = signal('');
  protected readonly selectedPeriod = signal('Turno actual');
  protected readonly isCreateOpen = signal(false);
  protected readonly pendingDelete = signal<{ id: string; title: string; type: string } | null>(null);

  protected readonly greetingName = computed(() => this.currentUser()?.name.trim().split(/\s+/)[0] || 'Andre');
  protected readonly currentDateLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected readonly userInitials = computed(() => (this.currentUser()?.name ?? 'Andre Zapata')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('es'))
    .join(''));

  constructor() {
    onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        this.setFirebaseSession(user);
      } else if (!this.readSessionUser()) {
        this.currentUser.set(null);
      }
    }, (error) => {
      this.authMessage.set(this.getAuthErrorMessage(error));
    });
  }

  protected readonly navigation = [
    { label: 'Resumen', icon: 'grid' },
    { label: 'Tareas', icon: 'clipboard', count: '18' },
    { label: 'Responsables', icon: 'users', count: '12' },
    { label: 'Solicitudes', icon: 'inbox', count: '7' },
    { label: 'Aprobaciones', icon: 'check-circle', count: '5' },
    { label: 'Plazos', icon: 'calendar', count: '4' },
    { label: 'Seguimiento de procesos', icon: 'activity', count: '6' },
  ];

  // Métricas principales de operaciones
  protected readonly metrics = computed(() => {
    const activeTasksCount = this.tasks().filter((t) => t.status !== 'Completada').length;
    const pendingApprovalsCount = this.approvals().filter((a) => a.status === 'Pendiente').length;
    const criticalDeadlinesCount = this.deadlines().filter((d) => d.status === 'Pendiente' && d.daysRemaining <= 3).length;
    const activeProcessesCount = this.operationalProcesses().filter((p) => p.status !== 'Completado').length;

    return [
      { label: 'Tareas activas', value: String(activeTasksCount), change: '+4 hoy', note: '6 urgentes', icon: 'clipboard', tone: 'blue' },
      { label: 'Aprobaciones pendientes', value: String(pendingApprovalsCount), change: 'SLA < 24h', note: '2 críticas', icon: 'check-circle', tone: 'amber' },
      { label: 'Plazos críticos semana', value: String(criticalDeadlinesCount), change: 'Prioridad alta', note: 'Próximos a vencer', icon: 'calendar', tone: 'coral' },
      { label: 'Procesos en seguimiento', value: String(activeProcessesCount), change: '94,2% a tiempo', note: 'Monitor en vivo', icon: 'activity', tone: 'green' },
    ];
  });

  // Procesos Operativos (Monitor de Seguimiento)
  protected readonly operationalProcesses = signal<OperationalProcess[]>([
    {
      id: 'prc-1',
      code: 'PRC-501',
      name: 'Mantenimiento Preventivo Mayor - Línea de Envasado 1',
      category: 'Mantenimiento de Planta',
      responsible: 'Carlos Mendoza',
      responsibleRole: 'Jefe de Mantenimiento',
      progress: 60,
      status: 'En tiempo',
      tone: 'green',
      startDate: '10 oct 2026',
      dueDate: '14 oct 2026',
      currentStepIndex: 2,
      steps: [
        { title: 'Diagnóstico e inspección previa', description: 'Revisión termográfica y vibracional.', assignee: 'Carlos Mendoza', status: 'completed', completedAt: '10 oct 11:30' },
        { title: 'Consignación y bloqueo LOTO', description: 'Corte de energía y protocolo de seguridad.', assignee: 'Marcos Quispe', status: 'completed', completedAt: '11 oct 08:15' },
        { title: 'Sustitución de rodamientos y sellos', description: 'Desmontaje mecánico de cabezales y lubricación.', assignee: 'Carlos Mendoza', status: 'current' },
        { title: 'Pruebas dinámicas y calibración', description: 'Arranque en vacío y pruebas con carga.', assignee: 'David Alva', status: 'upcoming' },
        { title: 'Liberación operativa y cierre', description: 'Firma de conformidad y entrega a producción.', assignee: 'Sofia Benítez', status: 'upcoming' },
      ],
    },
    {
      id: 'prc-2',
      code: 'PRC-502',
      name: 'Despliegue Logístico de Distribución - Zona Lima Norte',
      category: 'Logística y Despacho',
      responsible: 'Valeria Ramos',
      responsibleRole: 'Coordinadora de Logística',
      progress: 40,
      status: 'En riesgo',
      tone: 'amber',
      startDate: '11 oct 2026',
      dueDate: '13 oct 2026',
      currentStepIndex: 1,
      steps: [
        { title: 'Consolidación de pedidos en almacén', description: 'Picking y paletizado de lotes.', assignee: 'Valeria Ramos', status: 'completed', completedAt: '11 oct 16:45' },
        { title: 'Carga y verificación de precintos', description: 'Control de manifiesto y sellos de seguridad.', assignee: 'Valeria Ramos', status: 'current' },
        { title: 'Despacho de flota y ruta primaria', description: 'Monitoreo GPS en tiempo real.', assignee: 'Equipo Logístico', status: 'upcoming' },
        { title: 'Entrega a centros de distribución', description: 'Cotejo y firmas digitales en destino.', assignee: 'Supervisores de Centro', status: 'upcoming' },
        { title: 'Liquidación de guías de remisión', description: 'Validación en ERP e informe de entrega.', assignee: 'Valeria Ramos', status: 'upcoming' },
      ],
    },
    {
      id: 'prc-3',
      code: 'PRC-503',
      name: 'Auditoría Interna de Seguridad Industrial y EPP',
      category: 'Seguridad Operacional',
      responsible: 'Marcos Quispe',
      responsibleRole: 'Supervisor SST',
      progress: 80,
      status: 'En tiempo',
      tone: 'green',
      startDate: '08 oct 2026',
      dueDate: '15 oct 2026',
      currentStepIndex: 3,
      steps: [
        { title: 'Notificación a jefaturas de área', description: 'Envío de cronograma de auditoría.', assignee: 'Marcos Quispe', status: 'completed', completedAt: '08 oct 09:00' },
        { title: 'Recorrido técnico e inspección en campo', description: 'Inspección de líneas y puestos críticos.', assignee: 'Marcos Quispe', status: 'completed', completedAt: '09 oct 17:30' },
        { title: 'Levantamiento de observaciones', description: 'Registro fotográfico y hallazgos.', assignee: 'Marcos Quispe', status: 'completed', completedAt: '11 oct 14:00' },
        { title: 'Elaboración de plan de acción correctivo', description: 'Definición de plazos de subsanación.', assignee: 'Sofia Benítez', status: 'current' },
        { title: 'Cierre formal y reporte de gerencia', description: 'Presentación ejecutiva de resultados.', assignee: 'Marcos Quispe', status: 'upcoming' },
      ],
    },
    {
      id: 'prc-4',
      code: 'PRC-504',
      name: 'Recepción y Validación Técnica de Insumos Q4',
      category: 'Control y Calidad',
      responsible: 'David Alva',
      responsibleRole: 'Inspector de Calidad',
      progress: 20,
      status: 'En tiempo',
      tone: 'blue',
      startDate: '12 oct 2026',
      dueDate: '16 oct 2026',
      currentStepIndex: 0,
      steps: [
        { title: 'Arribo de transporte y cotejo documental', description: 'Revisión de certificados de calidad de origen.', assignee: 'David Alva', status: 'current' },
        { title: 'Muestreo aleatorio en zona de cuarentena', description: 'Extracción de muestras representativas.', assignee: 'David Alva', status: 'upcoming' },
        { title: 'Ensayos de laboratorio y dimensionales', description: 'Pruebas de resistencia y tolerancias.', assignee: 'Equipo de Calidad', status: 'upcoming' },
        { title: 'Emisión de certificado de conformidad', description: 'Aprobación técnica de ingreso.', assignee: 'David Alva', status: 'upcoming' },
        { title: 'Ingreso al almacén general ERP', description: 'Liberación para uso en planta.', assignee: 'Valeria Ramos', status: 'upcoming' },
      ],
    },
  ]);

  // Proceso destacado para el monitor en el Dashboard
  protected readonly featuredProcess = computed(() => {
    return this.operationalProcesses().find((p) => p.status !== 'Completado') || this.operationalProcesses()[0];
  });

  // Tareas Operativas
  protected readonly tasks = signal<OperationalTask[]>([
    {
      id: 'tar-1',
      code: 'TAR-101',
      title: 'Mantenimiento correctivo bomba hidráulica principal',
      description: 'Fuga de aceite detectada en el sello mecánico. Requiere desmontaje y cambio urgente.',
      department: 'Mantenimiento',
      assignee: 'Carlos Mendoza',
      assigneeInitials: 'CM',
      priority: 'Urgente',
      priorityTone: 'coral',
      status: 'En curso',
      statusTone: 'blue',
      dueDate: 'Hoy · 16:00',
    },
    {
      id: 'tar-2',
      code: 'TAR-102',
      title: 'Despacho de insumos químicos para sede San Isidro',
      description: 'Preparar palets con precintos de seguridad y hoja MSDS firmada.',
      department: 'Logística',
      assignee: 'Valeria Ramos',
      assigneeInitials: 'VR',
      priority: 'Alta',
      priorityTone: 'amber',
      status: 'Pendiente',
      statusTone: 'amber',
      dueDate: '13 oct 2026',
    },
    {
      id: 'tar-3',
      code: 'TAR-103',
      title: 'Inspección de equipos de protección personal (EPP)',
      description: 'Auditoría a 32 colaboradores de turno mañana en nave de producción.',
      department: 'Seguridad',
      assignee: 'Marcos Quispe',
      assigneeInitials: 'MQ',
      priority: 'Media',
      priorityTone: 'blue',
      status: 'En revisión',
      statusTone: 'purple',
      dueDate: '14 oct 2026',
    },
    {
      id: 'tar-4',
      code: 'TAR-104',
      title: 'Reasignación de cuadrilla para turno nocturno',
      description: 'Cubrir ausencia médica de 2 operarios en línea de embolsado.',
      department: 'Operaciones',
      assignee: 'Sofia Benítez',
      assigneeInitials: 'SB',
      priority: 'Urgente',
      priorityTone: 'coral',
      status: 'Bloqueada',
      statusTone: 'coral',
      dueDate: 'Hoy · 20:00',
    },
    {
      id: 'tar-5',
      code: 'TAR-105',
      title: 'Calibración de sensores de temperatura en cámaras',
      description: 'Verificación trimestral con termómetro patrón certificado.',
      department: 'Control de Calidad',
      assignee: 'David Alva',
      assigneeInitials: 'DA',
      priority: 'Baja',
      priorityTone: 'green',
      status: 'Completada',
      statusTone: 'green',
      dueDate: '11 oct 2026',
    },
    {
      id: 'tar-6',
      code: 'TAR-106',
      title: 'Sanitización profunda de áreas comunes y lockers',
      description: 'Protocolo de higiene semanal con nebulización desinfectante.',
      department: 'Limpieza y Servicios',
      assignee: 'Lucía Gómez',
      assigneeInitials: 'LG',
      priority: 'Alta',
      priorityTone: 'amber',
      status: 'En curso',
      statusTone: 'blue',
      dueDate: '13 oct 2026',
    },
  ]);

  // Responsables del Equipo
  protected readonly leaders = signal<OperationalLeader[]>([
    {
      id: 'ldr-1',
      code: 'RESP-01',
      name: 'Carlos Mendoza',
      role: 'Jefe de Mantenimiento',
      department: 'Mantenimiento',
      email: 'carlos.mendoza@aura.pe',
      phone: '+51 987 654 321',
      activeTasks: 5,
      completionRate: '96%',
      status: 'En operativo',
      statusTone: 'blue',
      initials: 'CM',
    },
    {
      id: 'ldr-2',
      code: 'RESP-02',
      name: 'Valeria Ramos',
      role: 'Coordinadora de Logística',
      department: 'Logística',
      email: 'valeria.ramos@aura.pe',
      phone: '+51 912 345 678',
      activeTasks: 4,
      completionRate: '94%',
      status: 'Disponible',
      statusTone: 'green',
      initials: 'VR',
    },
    {
      id: 'ldr-3',
      code: 'RESP-03',
      name: 'Marcos Quispe',
      role: 'Supervisor de SST y Operaciones',
      department: 'Seguridad',
      email: 'marcos.quispe@aura.pe',
      phone: '+51 933 221 144',
      activeTasks: 3,
      completionRate: '98%',
      status: 'En guardia',
      statusTone: 'amber',
      initials: 'MQ',
    },
    {
      id: 'ldr-4',
      code: 'RESP-04',
      name: 'Sofia Benítez',
      role: 'Líder de Operaciones en Planta',
      department: 'Operaciones',
      email: 'sofia.benitez@aura.pe',
      phone: '+51 977 889 900',
      activeTasks: 6,
      completionRate: '92%',
      status: 'En operativo',
      statusTone: 'blue',
      initials: 'SB',
    },
    {
      id: 'ldr-5',
      code: 'RESP-05',
      name: 'David Alva',
      role: 'Inspector de Control de Calidad',
      department: 'Control de Calidad',
      email: 'david.alva@aura.pe',
      phone: '+51 944 556 677',
      activeTasks: 2,
      completionRate: '99%',
      status: 'Disponible',
      statusTone: 'green',
      initials: 'DA',
    },
    {
      id: 'ldr-6',
      code: 'RESP-06',
      name: 'Lucía Gómez',
      role: 'Supervisora de Servicios y Sanitización',
      department: 'Limpieza y Servicios',
      email: 'lucia.gomez@aura.pe',
      phone: '+51 922 443 355',
      activeTasks: 4,
      completionRate: '95%',
      status: 'En operativo',
      statusTone: 'blue',
      initials: 'LG',
    },
  ]);

  // Solicitudes Operativas
  protected readonly requests = signal<OperationalRequest[]>([
    {
      id: 'req-1',
      code: 'SOL-2026-44',
      title: 'Adquisición urgente de válvula hidráulica de repuesto',
      category: 'Materiales y equipos',
      requester: 'Carlos Mendoza',
      department: 'Mantenimiento',
      createdAt: 'Hoy · 09:15',
      urgency: 'Urgente',
      urgencyTone: 'coral',
      status: 'Pendiente',
      statusTone: 'amber',
      details: 'Para reparar línea de envasado 1 sin detener producción más de 4 horas.',
    },
    {
      id: 'req-2',
      code: 'SOL-2026-43',
      title: 'Habilitación de transporte especial para turno noche',
      category: 'Transporte y logística',
      requester: 'Valeria Ramos',
      department: 'Logística',
      createdAt: 'Ayer · 17:30',
      urgency: 'Alta',
      urgencyTone: 'amber',
      status: 'En evaluación',
      statusTone: 'blue',
      details: 'Traslado seguro de 8 operarios tras cierre de turno a las 23:00.',
    },
    {
      id: 'req-3',
      code: 'SOL-2026-42',
      title: 'Reposición de 40 unidades de cascos dieléctricos',
      category: 'Insumos y EPP',
      requester: 'Marcos Quispe',
      department: 'Seguridad',
      createdAt: '10 oct 2026',
      urgency: 'Alta',
      urgencyTone: 'amber',
      status: 'Aprobada',
      statusTone: 'green',
      details: 'Norma ANSI Z89.1 para personal técnico de subestación.',
    },
    {
      id: 'req-4',
      code: 'SOL-2026-41',
      title: 'Refuerzo de 2 operarios por carga extraordinaria',
      category: 'Personal de apoyo',
      requester: 'Sofia Benítez',
      department: 'Operaciones',
      createdAt: '11 oct 2026',
      urgency: 'Urgente',
      urgencyTone: 'coral',
      status: 'Pendiente',
      statusTone: 'amber',
      details: 'Recepción de contenedores Q4 en muelle norte este fin de semana.',
    },
  ]);

  // Aprobaciones Operativas
  protected readonly approvals = signal<OperationalApproval[]>([
    {
      id: 'apr-1',
      code: 'APR-089',
      subject: 'Compra de válvula de alivio y sellos de alta presión',
      requester: 'Carlos Mendoza',
      category: 'Repuestos de Planta',
      submissionDate: 'Hoy · 09:30',
      deadlineSLA: 'Hoy · 14:00 (4h restantes)',
      costOrImpact: 'S/ 3,450.00',
      status: 'Pendiente',
      statusTone: 'amber',
    },
    {
      id: 'apr-2',
      code: 'APR-088',
      subject: 'Autorización de cuadrilla extraordinaria en fin de semana',
      requester: 'Sofia Benítez',
      category: 'Horas Operativas',
      submissionDate: 'Hoy · 10:15',
      deadlineSLA: 'Hoy · 18:00',
      costOrImpact: 'S/ 1,920.00 (8 operarios)',
      status: 'Pendiente',
      statusTone: 'amber',
    },
    {
      id: 'apr-3',
      code: 'APR-087',
      subject: 'Servicio técnico especializado de calibración ISO 9001',
      requester: 'David Alva',
      category: 'Servicio Externo',
      submissionDate: 'Ayer · 16:00',
      deadlineSLA: 'Mañana · 12:00',
      costOrImpact: 'S/ 5,600.00',
      status: 'Pendiente',
      statusTone: 'amber',
    },
    {
      id: 'apr-4',
      code: 'APR-086',
      subject: 'Lote mensual de químicos desinfectantes y bio-detergentes',
      requester: 'Lucía Gómez',
      category: 'Insumos Operativos',
      submissionDate: '09 oct 2026',
      deadlineSLA: 'Aprobado a tiempo',
      costOrImpact: 'S/ 2,150.00',
      status: 'Aprobado',
      statusTone: 'green',
    },
    {
      id: 'apr-5',
      code: 'APR-085',
      subject: 'Reparación de urgencia montacargas Toyota 03',
      requester: 'Valeria Ramos',
      category: 'Mantenimiento Flota',
      submissionDate: '08 oct 2026',
      deadlineSLA: 'Rechazado (Cotización fuera de rango)',
      costOrImpact: 'S/ 4,800.00',
      status: 'Rechazado',
      statusTone: 'coral',
    },
  ]);

  // Plazos Críticos
  protected readonly deadlines = signal<OperationalDeadline[]>([
    {
      id: 'plz-1',
      code: 'PLZ-031',
      title: 'Entrega de informe mensual de rendimiento operativo a gerencia',
      relatedEntity: 'Operaciones Planta',
      category: 'Cierre de fase',
      targetDate: 'Hoy · 17:00',
      daysRemaining: 0,
      urgencyText: 'Vence hoy',
      urgencyTone: 'coral',
      status: 'Pendiente',
    },
    {
      id: 'plz-2',
      code: 'PLZ-032',
      title: 'Renovación de póliza de seguro complementario (SCTR)',
      relatedEntity: 'Seguridad y Legal',
      category: 'Renovación de permisos',
      targetDate: 'Mañana · 12:00',
      daysRemaining: 1,
      urgencyText: 'Vence en 24h',
      urgencyTone: 'coral',
      status: 'Pendiente',
    },
    {
      id: 'plz-3',
      code: 'PLZ-033',
      title: 'Auditoría interna preventiva en nave industrial B',
      relatedEntity: 'Control de Calidad',
      category: 'Auditoría interna',
      targetDate: '15 oct 2026',
      daysRemaining: 3,
      urgencyText: 'En 3 días',
      urgencyTone: 'amber',
      status: 'Pendiente',
    },
    {
      id: 'plz-4',
      code: 'PLZ-034',
      title: 'Mantenimiento semestral grupo electrógeno de emergencia',
      relatedEntity: 'Mantenimiento',
      category: 'Mantenimiento preventivo',
      targetDate: '18 oct 2026',
      daysRemaining: 6,
      urgencyText: 'En 6 días',
      urgencyTone: 'blue',
      status: 'Pendiente',
    },
    {
      id: 'plz-5',
      code: 'PLZ-035',
      title: 'Cierre de ciclo de capacitación y certificación de operadores',
      relatedEntity: 'Recursos Humanos',
      category: 'Capacitación',
      targetDate: '24 oct 2026',
      daysRemaining: 12,
      urgencyText: 'En 12 días',
      urgencyTone: 'green',
      status: 'Pendiente',
    },
  ]);

  // Filtros computados por búsqueda
  protected readonly filteredTasks = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.tasks();
    return this.tasks().filter((task) =>
      `${task.code} ${task.title} ${task.description} ${task.department} ${task.assignee} ${task.priority} ${task.status}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly filteredLeaders = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.leaders();
    return this.leaders().filter((leader) =>
      `${leader.code} ${leader.name} ${leader.role} ${leader.department} ${leader.status} ${leader.email}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly filteredRequests = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.requests();
    return this.requests().filter((req) =>
      `${req.code} ${req.title} ${req.category} ${req.requester} ${req.department} ${req.urgency} ${req.status}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly filteredApprovals = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.approvals();
    return this.approvals().filter((appr) =>
      `${appr.code} ${appr.subject} ${appr.requester} ${appr.category} ${appr.status}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly filteredDeadlines = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.deadlines();
    return this.deadlines().filter((d) =>
      `${d.code} ${d.title} ${d.relatedEntity} ${d.category} ${d.urgencyText} ${d.status}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly filteredProcesses = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.operationalProcesses();
    return this.operationalProcesses().filter((proc) =>
      `${proc.code} ${proc.name} ${proc.category} ${proc.responsible} ${proc.status}`
        .toLocaleLowerCase('es')
        .includes(term),
    );
  });

  protected readonly activeModuleDescription = computed(() => {
    const map: Record<string, string> = {
      Resumen: 'Control centralizado, métricas clave y monitor de procesos en vivo.',
      Tareas: 'Asignación, estados operativos, prioridades y ejecución diaria.',
      Responsables: 'Líderes de equipo, supervisores y carga operativa asignada.',
      Solicitudes: 'Requerimientos internos de materiales, servicios y recursos.',
      Aprobaciones: 'Flujo de decisión rápida para solicitudes con control de SLA.',
      Plazos: 'Calendario de hitos, vencimientos de normativas y fechas críticas.',
      'Seguimiento de procesos': 'Monitor interactivo paso a paso para el control de procesos internos.',
    };
    return map[this.activeNav()] ?? '';
  });

  protected readonly createActionLabel = computed(() => {
    const labels: Record<string, string> = {
      Tareas: 'Nueva tarea',
      Responsables: 'Nuevo responsable',
      Solicitudes: 'Nueva solicitud',
      Aprobaciones: 'Nueva aprobación',
      Plazos: 'Nuevo plazo',
      'Seguimiento de procesos': 'Nuevo proceso',
    };
    return labels[this.activeNav()] ?? 'Nuevo registro';
  });

  // Campos para el modal de creación
  protected readonly createFields = computed(() => {
    const moduleName = this.activeNav();
    const fields: Record<string, CreateField[]> = {
      Tareas: [
        { name: 'title', label: 'Título de la tarea', type: 'text', required: true, placeholder: 'Ej. Cambio de filtro en compresora' },
        { name: 'assignee', label: 'Responsable', type: 'text', required: true, placeholder: 'Nombre del colaborador' },
        { name: 'department', label: 'Área / Departamento', type: 'select', required: true, options: ['Operaciones', 'Mantenimiento', 'Logística', 'Seguridad', 'Control de Calidad', 'Limpieza y Servicios'] },
        { name: 'priority', label: 'Prioridad', type: 'select', required: true, options: ['Urgente', 'Alta', 'Media', 'Baja'] },
        { name: 'dueDate', label: 'Fecha / Plazo límite', type: 'text', required: true, placeholder: 'Ej. Hoy 18:00 o 15 oct 2026' },
        { name: 'description', label: 'Detalles operativos', type: 'textarea', required: true, wide: true, placeholder: 'Describe el alcance de la tarea y precauciones' },
      ],
      Responsables: [
        { name: 'title', label: 'Nombre completo', type: 'text', required: true, placeholder: 'Nombre y apellidos' },
        { name: 'role', label: 'Cargo u ocupación', type: 'text', required: true, placeholder: 'Ej. Supervisor de Planta' },
        { name: 'department', label: 'Departamento', type: 'select', required: true, options: ['Operaciones', 'Mantenimiento', 'Logística', 'Seguridad', 'Control de Calidad', 'Limpieza y Servicios'] },
        { name: 'email', label: 'Correo corporativo', type: 'email', required: true, placeholder: 'nombre@aura.pe' },
        { name: 'phone', label: 'Teléfono de contacto', type: 'tel', required: true, placeholder: '+51 900 000 000' },
        { name: 'status', label: 'Estado operativo', type: 'select', required: true, options: ['Disponible', 'En operativo', 'En guardia', 'En descanso'] },
      ],
      Solicitudes: [
        { name: 'title', label: 'Asunto de la solicitud', type: 'text', required: true, placeholder: 'Ej. Pedido de 20 galones de lubricante ISO 68' },
        { name: 'category', label: 'Categoría', type: 'select', required: true, options: ['Materiales y equipos', 'Mantenimiento preventivo', 'Horas extras operativas', 'Transporte y logística', 'Personal de apoyo', 'Insumos y EPP'] },
        { name: 'requester', label: 'Solicitante', type: 'text', required: true, placeholder: 'Tu nombre o área' },
        { name: 'department', label: 'Departamento', type: 'select', required: true, options: ['Operaciones', 'Mantenimiento', 'Logística', 'Seguridad', 'Control de Calidad'] },
        { name: 'urgency', label: 'Urgencia', type: 'select', required: true, options: ['Urgente', 'Alta', 'Media'] },
        { name: 'description', label: 'Justificación / Detalle', type: 'textarea', required: true, wide: true, placeholder: 'Explica por qué se requiere y fecha máxima de necesidad' },
      ],
      Aprobaciones: [
        { name: 'title', label: 'Asunto / Requerimiento', type: 'text', required: true, placeholder: 'Ej. Autorización de compra de repuestos' },
        { name: 'requester', label: 'Responsable solicitante', type: 'text', required: true, placeholder: 'Nombre del responsable' },
        { name: 'category', label: 'Categoría', type: 'select', required: true, options: ['Repuestos de Planta', 'Horas Operativas', 'Servicio Externo', 'Insumos Operativos', 'Mantenimiento Flota'] },
        { name: 'costOrImpact', label: 'Impacto / Costo estimado', type: 'text', required: true, placeholder: 'Ej. S/ 2,400.00 o 6 operarios' },
        { name: 'deadlineSLA', label: 'Tiempo límite de resolución (SLA)', type: 'text', required: true, placeholder: 'Ej. Hoy 18:00 o 24 horas' },
      ],
      Plazos: [
        { name: 'title', label: 'Nombre del hito o plazo', type: 'text', required: true, placeholder: 'Ej. Renovación de licencia municipal de planta' },
        { name: 'relatedEntity', label: 'Operación o área vinculada', type: 'text', required: true, placeholder: 'Ej. Operaciones Central' },
        { name: 'category', label: 'Tipo de plazo', type: 'select', required: true, options: ['Cierre de fase', 'Renovación de permisos', 'Auditoría interna', 'Mantenimiento preventivo', 'Capacitación'] },
        { name: 'targetDate', label: 'Fecha objetivo', type: 'text', required: true, placeholder: 'Ej. 20 oct 2026' },
        { name: 'urgencyText', label: 'Nivel de criticidad', type: 'select', required: true, options: ['Vence hoy', 'Vence en 24h', 'En 3 días', 'En 7 días', 'Programado'] },
      ],
      'Seguimiento de procesos': [
        { name: 'title', label: 'Nombre del proceso interno', type: 'text', required: true, placeholder: 'Ej. Protocolo de puesta en marcha línea 2' },
        { name: 'category', label: 'Línea operativa', type: 'select', required: true, options: ['Mantenimiento de Planta', 'Logística y Despacho', 'Seguridad Operacional', 'Control y Calidad', 'Servicios en Campo'] },
        { name: 'responsible', label: 'Líder responsable', type: 'text', required: true, placeholder: 'Nombre del líder' },
        { name: 'responsibleRole', label: 'Cargo', type: 'text', required: true, placeholder: 'Ej. Supervisor Técnico' },
        { name: 'dueDate', label: 'Fecha estimada de finalización', type: 'text', required: true, placeholder: 'Ej. 18 oct 2026' },
        { name: 'description', label: 'Descripción general del proceso', type: 'textarea', required: true, wide: true, placeholder: 'Explica los objetivos y alcance de las etapas' },
      ],
    };
    return fields[moduleName] ?? fields['Tareas'];
  });

  // Métodos interactivos: Sigue los pasos al monitor
  protected advanceProcessStep(processId: string): void {
    this.operationalProcesses.update((processes) =>
      processes.map((proc) => {
        if (proc.id !== processId) return proc;
        const total = proc.steps.length;
        if (proc.currentStepIndex >= total - 1) {
          // Último paso completado
          const updatedSteps = proc.steps.map((s, idx) =>
            idx === total - 1
              ? { ...s, status: 'completed' as const, completedAt: 'Hoy ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) }
              : s,
          );
          return {
            ...proc,
            currentStepIndex: total,
            progress: 100,
            status: 'Completado' as const,
            tone: 'green' as const,
            steps: updatedSteps,
          };
        }

        const nextIndex = proc.currentStepIndex + 1;
        const updatedSteps = proc.steps.map((s, idx) => {
          if (idx < nextIndex) {
            return {
              ...s,
              status: 'completed' as const,
              completedAt: s.completedAt || ('Hoy ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })),
            };
          }
          if (idx === nextIndex) {
            return { ...s, status: 'current' as const };
          }
          return { ...s, status: 'upcoming' as const };
        });

        const progress = Math.round(((nextIndex + 1) / total) * 100);
        return {
          ...proc,
          currentStepIndex: nextIndex,
          progress,
          status: progress === 100 ? 'Completado' : proc.status,
          steps: updatedSteps,
        };
      }),
    );
  }

  protected resetProcess(processId: string): void {
    this.operationalProcesses.update((processes) =>
      processes.map((proc) => {
        if (proc.id !== processId) return proc;
        const updatedSteps = proc.steps.map((s, idx) => ({
          ...s,
          status: idx === 0 ? ('current' as const) : ('upcoming' as const),
          completedAt: undefined,
        }));
        return {
          ...proc,
          currentStepIndex: 0,
          progress: Math.round((1 / proc.steps.length) * 100),
          status: 'En tiempo' as const,
          tone: 'green' as const,
          steps: updatedSteps,
        };
      }),
    );
  }

  // Tareas: Ciclo de vida y estados
  protected cycleTaskStatus(taskId: string): void {
    const transitions: Record<OperationalTask['status'], { next: OperationalTask['status']; tone: OperationalTask['statusTone'] }> = {
      Pendiente: { next: 'En curso', tone: 'blue' },
      'En curso': { next: 'En revisión', tone: 'purple' },
      'En revisión': { next: 'Completada', tone: 'green' },
      Completada: { next: 'Pendiente', tone: 'amber' },
      Bloqueada: { next: 'En curso', tone: 'blue' },
    };

    this.tasks.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) return task;
        const nextState = transitions[task.status];
        return {
          ...task,
          status: nextState.next,
          statusTone: nextState.tone,
        };
      }),
    );
  }

  // Aprobaciones: Acciones rápidas
  protected approveItem(approvalId: string): void {
    this.approvals.update((items) =>
      items.map((item) =>
        item.id === approvalId
          ? { ...item, status: 'Aprobado', statusTone: 'green' }
          : item,
      ),
    );
  }

  protected rejectItem(approvalId: string): void {
    this.approvals.update((items) =>
      items.map((item) =>
        item.id === approvalId
          ? { ...item, status: 'Rechazado', statusTone: 'coral' }
          : item,
      ),
    );
  }

  // Solicitudes: Estado
  protected toggleRequestStatus(reqId: string): void {
    this.requests.update((reqs) =>
      reqs.map((req) => {
        if (req.id !== reqId) return req;
        const isApproved = req.status === 'Aprobada';
        return {
          ...req,
          status: isApproved ? 'Pendiente' : 'Aprobada',
          statusTone: isApproved ? 'amber' : 'green',
        };
      }),
    );
  }

  // Plazos: Marcar cumplido
  protected toggleDeadlineStatus(deadlineId: string): void {
    this.deadlines.update((items) =>
      items.map((item) => {
        if (item.id !== deadlineId) return item;
        const isDone = item.status === 'Cumplido';
        return {
          ...item,
          status: isDone ? 'Pendiente' : 'Cumplido',
          urgencyTone: isDone ? 'amber' : 'green',
        };
      }),
    );
  }

  // Creación de registros dinámicos
  protected createRecord(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const fields = Object.fromEntries(
      this.createFields().map((field) => [field.name, String(values.get(field.name) ?? '').trim()]),
    );

    const title = fields['title'] || '';
    if (!title) return;

    const module = this.activeNav();
    const randomSuffix = Math.floor(100 + Math.random() * 900);

    if (module === 'Tareas') {
      const priority = (fields['priority'] || 'Media') as OperationalTask['priority'];
      const priorityTones: Record<string, OperationalTask['priorityTone']> = {
        Urgente: 'coral',
        Alta: 'amber',
        Media: 'blue',
        Baja: 'green',
      };
      const assignee = fields['assignee'] || 'Colaborador Aura';
      const initials = assignee.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'AU';

      const newTask: OperationalTask = {
        id: `tar-${Date.now()}`,
        code: `TAR-${randomSuffix}`,
        title,
        description: fields['description'] || 'Tarea operativa asignada en el sistema.',
        department: fields['department'] || 'Operaciones',
        assignee,
        assigneeInitials: initials,
        priority,
        priorityTone: priorityTones[priority] || 'blue',
        status: 'Pendiente',
        statusTone: 'amber',
        dueDate: fields['dueDate'] || 'Programada',
      };
      this.tasks.update((items) => [newTask, ...items]);
    } else if (module === 'Responsables') {
      const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'AU';
      const newLeader: OperationalLeader = {
        id: `ldr-${Date.now()}`,
        code: `RESP-${randomSuffix}`,
        name: title,
        role: fields['role'] || 'Operador',
        department: fields['department'] || 'Operaciones',
        email: fields['email'] || 'contacto@aura.pe',
        phone: fields['phone'] || '+51 900 000 000',
        activeTasks: 1,
        completionRate: '100%',
        status: (fields['status'] as OperationalLeader['status']) || 'Disponible',
        statusTone: 'green',
        initials,
      };
      this.leaders.update((items) => [newLeader, ...items]);
    } else if (module === 'Solicitudes') {
      const urgency = (fields['urgency'] || 'Media') as OperationalRequest['urgency'];
      const newReq: OperationalRequest = {
        id: `req-${Date.now()}`,
        code: `SOL-2026-${randomSuffix}`,
        title,
        category: fields['category'] || 'Materiales y equipos',
        requester: fields['requester'] || 'Responsable de turno',
        department: fields['department'] || 'Operaciones',
        createdAt: 'Hoy · ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        urgency,
        urgencyTone: urgency === 'Urgente' ? 'coral' : urgency === 'Alta' ? 'amber' : 'blue',
        status: 'Pendiente',
        statusTone: 'amber',
        details: fields['description'] || 'Solicitud generada internamente.',
      };
      this.requests.update((items) => [newReq, ...items]);
    } else if (module === 'Aprobaciones') {
      const newAppr: OperationalApproval = {
        id: `apr-${Date.now()}`,
        code: `APR-${randomSuffix}`,
        subject: title,
        requester: fields['requester'] || 'Responsable',
        category: fields['category'] || 'Operativa',
        submissionDate: 'Hoy · ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        deadlineSLA: fields['deadlineSLA'] || 'Hoy · 18:00',
        costOrImpact: fields['costOrImpact'] || 'Pendiente de evaluación',
        status: 'Pendiente',
        statusTone: 'amber',
      };
      this.approvals.update((items) => [newAppr, ...items]);
    } else if (module === 'Plazos') {
      const newDeadline: OperationalDeadline = {
        id: `plz-${Date.now()}`,
        code: `PLZ-${randomSuffix}`,
        title,
        relatedEntity: fields['relatedEntity'] || 'Operaciones',
        category: fields['category'] || 'Hito operativo',
        targetDate: fields['targetDate'] || 'Próximamente',
        daysRemaining: 7,
        urgencyText: fields['urgencyText'] || 'Programado',
        urgencyTone: 'blue',
        status: 'Pendiente',
      };
      this.deadlines.update((items) => [newDeadline, ...items]);
    } else if (module === 'Seguimiento de procesos') {
      const newProcess: OperationalProcess = {
        id: `prc-${Date.now()}`,
        code: `PRC-${randomSuffix}`,
        name: title,
        category: fields['category'] || 'Mantenimiento de Planta',
        responsible: fields['responsible'] || 'Líder Operativo',
        responsibleRole: fields['responsibleRole'] || 'Supervisor',
        progress: 20,
        status: 'En tiempo',
        tone: 'green',
        startDate: 'Hoy',
        dueDate: fields['dueDate'] || 'Próximamente',
        currentStepIndex: 0,
        steps: [
          { title: 'Fase 1: Apertura y diagnóstico', description: fields['description'] || 'Inicio formal del proceso.', assignee: fields['responsible'] || 'Líder', status: 'current' },
          { title: 'Fase 2: Asignación y recursos', description: 'Coordinación con equipo de planta.', assignee: 'Equipo de Planta', status: 'upcoming' },
          { title: 'Fase 3: Ejecución operativa', description: 'Desarrollo de trabajos programados.', assignee: 'Operarios', status: 'upcoming' },
          { title: 'Fase 4: Control de calidad y pruebas', description: 'Inspección técnica de conformidad.', assignee: 'Control de Calidad', status: 'upcoming' },
          { title: 'Fase 5: Cierre y entrega', description: 'Acta de finalización aprobada.', assignee: 'Supervisión', status: 'upcoming' },
        ],
      };
      this.operationalProcesses.update((items) => [newProcess, ...items]);
    }

    form.reset();
    this.isCreateOpen.set(false);
  }

  // Eliminación con confirmación
  protected requestDelete(id: string, title: string, type: string): void {
    this.pendingDelete.set({ id, title, type });
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;

    if (item.type === 'task') {
      this.tasks.update((list) => list.filter((t) => t.id !== item.id));
    } else if (item.type === 'leader') {
      this.leaders.update((list) => list.filter((l) => l.id !== item.id));
    } else if (item.type === 'request') {
      this.requests.update((list) => list.filter((r) => r.id !== item.id));
    } else if (item.type === 'approval') {
      this.approvals.update((list) => list.filter((a) => a.id !== item.id));
    } else if (item.type === 'deadline') {
      this.deadlines.update((list) => list.filter((d) => d.id !== item.id));
    } else if (item.type === 'process') {
      this.operationalProcesses.update((list) => list.filter((p) => p.id !== item.id));
    }

    this.pendingDelete.set(null);
  }

  // Navegación y UI
  protected selectNavigation(label: string): void {
    this.activeNav.set(label);
    this.searchTerm.set('');
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updatePeriod(event: Event): void {
    this.selectedPeriod.set((event.target as HTMLSelectElement).value);
  }

  protected openCreateDialog(): void {
    this.isCreateOpen.set(true);
  }

  protected closeCreateDialog(): void {
    this.isCreateOpen.set(false);
  }

  protected toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((open) => !open);
  }

  protected openProfileDetails(): void {
    this.isProfileMenuOpen.set(false);
    this.isProfileDetailsOpen.set(true);
  }

  protected closeProfileDetails(): void {
    this.isProfileDetailsOpen.set(false);
  }

  // Autenticación
  protected setAuthMode(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authMessage.set('');
  }

  protected async completeAuthentication(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim().toLocaleLowerCase('es');
    const password = String(values.get('password') ?? '');
    const submittedName = String(values.get('name') ?? '').trim();

    if (this.authMode() === 'register' && password !== String(values.get('confirmPassword') ?? '')) {
      this.authMessage.set('Las contraseñas no coinciden.');
      return;
    }

    try {
      if (this.authMode() === 'register') {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (submittedName) await updateProfile(result.user, { displayName: submittedName });
        this.setFirebaseSession(result.user);
      } else if (email === demoAdminCredentials.email && password === demoAdminCredentials.password) {
        if (!this.startSession({ name: 'Andre Zapata', email, role: 'Administrador' })) return;
      } else {
        const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
        this.setFirebaseSession(result.user);
      }
      form.reset();
    } catch (error) {
      this.authMessage.set(this.getAuthErrorMessage(error));
    }
  }

  private setFirebaseSession(user: FirebaseUser): void {
    const session = {
      name: user.displayName || user.email?.split('@')[0] || 'Usuario AURA',
      email: user.email || '',
      role: 'Usuario' as const,
    };
    this.currentUser.set(session);
    this.activeNav.set('Resumen');
    this.authMessage.set('');
    try {
      sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(session));
    } catch {
      this.authMessage.set('No se pudo guardar la sesión en este navegador.');
    }
  }

  private getAuthErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (code === 'auth/unauthorized-domain') {
      return 'Este dominio no está autorizado. Añade localhost y el dominio de tu web en Firebase Authentication.';
    }
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      return 'Habilita Correo electrónico/contraseña en Firebase: Authentication → Método de acceso.';
    }
    if (code === 'auth/email-already-in-use') return 'Ya existe una cuenta con ese correo. Inicia sesión en lugar de registrarte.';
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-email' || code === 'auth/weak-password') return 'Revisa el correo y la contraseña e inténtalo de nuevo.';
    if (code === 'auth/network-request-failed') return 'No se pudo conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.';
    return `No se pudo autenticar${code ? ` (${code})` : ''}. Revisa el correo y la contraseña.`;
  }

  private startSession(session: UserSession): boolean {
    try {
      sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(session));
    } catch {
      this.authMessage.set('No se pudo guardar la sesión en este navegador.');
      return false;
    }
    this.currentUser.set(session);
    this.authMessage.set('');
    this.activeNav.set('Resumen');
    return true;
  }

  protected signOut(): void {
    if (this.isSigningOut()) return;
    this.isSigningOut.set(true);
    this.isProfileMenuOpen.set(false);
    setTimeout(() => {
      void firebaseSignOut(firebaseAuth).catch(() => undefined);
      try {
        sessionStorage.removeItem(this.sessionStorageKey);
      } catch {
      }
      this.currentUser.set(null);
      this.authMode.set('login');
      this.authMessage.set('');
      this.isSigningOut.set(false);
    }, 1500);
  }

  private readSessionUser(): UserSession | null {
    try {
      const stored = sessionStorage.getItem(this.sessionStorageKey);
      if (!stored) return null;
      const session = JSON.parse(stored) as Partial<UserSession>;
      return typeof session.name === 'string' && typeof session.email === 'string'
        ? {
          name: session.name,
          email: session.email,
          role: session.role === 'Administrador' && session.email === demoAdminCredentials.email
            ? 'Administrador'
            : 'Usuario',
        }
        : null;
    } catch {
      return null;
    }
  }
}
