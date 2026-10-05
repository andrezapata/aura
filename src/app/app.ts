import { Component, computed, signal } from '@angular/core';
import { demoAdminCredentials } from './demo-credentials';

interface ModuleRecord {
  id: string;
  title: string;
  subtitle: string;
  reference: string;
  status: string;
  tone: 'green' | 'amber' | 'coral' | 'blue';
}

interface CreateField {
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
}

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly sessionStorageKey = 'aura.session';
  protected readonly currentUser = signal<UserSession | null>(this.readSessionUser());
  protected readonly isAuthenticated = computed(() => this.currentUser() !== null);
  protected readonly authMode = signal<'login' | 'register'>('login');
  protected readonly authMessage = signal('');
  protected readonly isSigningOut = signal(false);
  protected readonly isProfileMenuOpen = signal(false);
  protected readonly activeNav = signal('Resumen');
  protected readonly searchTerm = signal('');
  protected readonly selectedPeriod = signal('Últimos 6 meses');
  protected readonly isCreateOpen = signal(false);
  protected readonly pendingDelete = signal<ModuleRecord | null>(null);
  protected readonly greetingName = computed(() => this.currentUser()?.name.trim().split(/\s+/)[0] || 'Andre');
  protected readonly userInitials = computed(() => (this.currentUser()?.name ?? 'Andre Zapata')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('es'))
    .join(''));

  protected readonly navigation = [
    { label: 'Resumen', icon: 'grid' },
    { label: 'Clientes', icon: 'users', count: '248' },
    { label: 'Equipo externo', icon: 'briefcase', count: '36' },
    { label: 'Facturación', icon: 'receipt', count: '12' },
    { label: 'Pagos', icon: 'wallet' },
    { label: 'Documentos', icon: 'file', count: '4' },
    { label: 'Incidencias', icon: 'alert', count: '3' },
    { label: 'Vacaciones y permisos', icon: 'calendar' },
  ];

  protected readonly metrics = [
    { label: 'Clientes activos', value: '248', change: '+8,4%', note: 'vs. mes anterior', icon: 'users', tone: 'green' },
    { label: 'Trabajadores externos', value: '36', change: '+3', note: 'vs. mes anterior', icon: 'briefcase', tone: 'blue' },
    { label: 'Facturas pendientes', value: '12', change: 'S/ 18,420', note: 'por cobrar', icon: 'receipt', tone: 'amber' },
    { label: 'Pagos del mes', value: 'S/ 86,240', change: '+12,8%', note: 'vs. mes anterior', icon: 'wallet', tone: 'coral' },
  ];

  protected readonly monthlyBars = [
    { month: 'May', income: 48, costs: 30 },
    { month: 'Jun', income: 63, costs: 42 },
    { month: 'Jul', income: 53, costs: 36 },
    { month: 'Ago', income: 76, costs: 48 },
    { month: 'Sep', income: 67, costs: 43 },
    { month: 'Oct', income: 91, costs: 58 },
  ];

  protected readonly documents = [
    { name: 'Certificado de prevención', person: 'Marcos Rivas · Cliente', date: 'Vence en 2 días', kind: 'MR', tone: 'peach' },
    { name: 'Seguro de responsabilidad', person: 'Nexo Facility · Proveedor', date: 'Vence en 5 días', kind: 'NF', tone: 'blue' },
    { name: 'DNI — renovación', person: 'Lucía Pardo · Personal', date: 'Vence en 8 días', kind: 'LP', tone: 'lilac' },
    { name: 'Certificado de formación', person: 'Iván Costa · Personal', date: 'Vence en 12 días', kind: 'IC', tone: 'mint' },
  ];

  protected readonly invoices = [
    { id: 'FAC-2026-084', client: 'Grupo Altamar', date: '02 oct 2026', amount: 'S/ 4,850.00', status: 'Vencida', tone: 'red' },
    { id: 'FAC-2026-091', client: 'Clínica del Prado', date: '08 oct 2026', amount: 'S/ 2,340.00', status: 'Pendiente', tone: 'amber' },
    { id: 'FAC-2026-096', client: 'Espacios Norte', date: '14 oct 2026', amount: 'S/ 6,120.00', status: 'Pendiente', tone: 'amber' },
  ];

  protected readonly filteredInvoices = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return this.invoices;
    return this.invoices.filter((invoice) =>
      `${invoice.id} ${invoice.client} ${invoice.status}`.toLocaleLowerCase('es').includes(term),
    );
  });

  protected readonly filteredModuleRecords = computed(() => {
    const moduleName = this.activeNav() === 'Resumen' ? 'Clientes' : this.activeNav();
    const records = this.moduleRecords()[moduleName] ?? [];
    const term = this.searchTerm().trim().toLocaleLowerCase('es');
    if (!term) return records;
    return records.filter((record) =>
      `${record.id} ${record.title} ${record.subtitle} ${record.status}`.toLocaleLowerCase('es').includes(term),
    );
  });

  protected readonly activeModuleDescription = computed(() =>
    this.moduleDescriptions[this.activeNav()] ?? '',
  );

  protected readonly createModuleName = computed(() =>
    this.activeNav() === 'Resumen' ? 'Clientes' : this.activeNav(),
  );

  protected readonly createActionLabel = computed(() => {
    const labels: Record<string, string> = {
      Clientes: 'Nuevo cliente',
      'Equipo externo': 'Nuevo colaborador',
      Facturación: 'Nueva factura',
      Pagos: 'Nuevo pago',
      Documentos: 'Nuevo documento',
      Incidencias: 'Nueva incidencia',
      'Vacaciones y permisos': 'Nueva solicitud',
    };
    return labels[this.createModuleName()] ?? 'Nuevo registro';
  });

  protected readonly createFields = computed(() => {
    const fields: Record<string, CreateField[]> = {
      Clientes: [
        { name: 'title', label: 'Razón social', type: 'text', required: true, placeholder: 'Nombre de la empresa' },
        { name: 'subtitle', label: 'Persona de contacto', type: 'text', placeholder: 'Nombre y apellidos' },
        { name: 'service', label: 'Servicio contratado', type: 'select', options: ['Limpieza', 'Mantenimiento', 'Logística', 'Otro'] },
        { name: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'contacto@empresa.com' },
        { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: '+51 900 000 000' },
      ],
      'Equipo externo': [
        { name: 'title', label: 'Proveedor o colaborador', type: 'text', required: true, placeholder: 'Nombre o razón social' },
        { name: 'subtitle', label: 'Especialidad o servicio', type: 'text', required: true, placeholder: 'Ej. mantenimiento eléctrico' },
        { name: 'assignment', label: 'Centro o cliente asignado', type: 'text', placeholder: 'Centro de trabajo' },
        { name: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'contacto@empresa.com' },
        { name: 'phone', label: 'Teléfono', type: 'tel', placeholder: '+51 900 000 000' },
      ],
      Facturación: [
        { name: 'title', label: 'Número de factura', type: 'text', required: true, placeholder: 'FAC-2026-100' },
        { name: 'subtitle', label: 'Cliente', type: 'text', required: true, placeholder: 'Nombre del cliente' },
        { name: 'amount', label: 'Importe (S/)', type: 'number', required: true, min: 0.01, step: '0.01', placeholder: '0.00' },
        { name: 'dueDate', label: 'Fecha de vencimiento', type: 'date', required: true },
      ],
      Pagos: [
        { name: 'title', label: 'Cliente o proveedor', type: 'text', required: true, placeholder: 'Nombre' },
        { name: 'amount', label: 'Importe (S/)', type: 'number', required: true, min: 0.01, step: '0.01', placeholder: '0.00' },
        { name: 'paymentDate', label: 'Fecha del pago', type: 'date', required: true },
        { name: 'method', label: 'Método de pago', type: 'select', required: true, options: ['Transferencia', 'Depósito', 'Tarjeta', 'Efectivo'] },
      ],
      Documentos: [
        { name: 'title', label: 'Nombre del documento', type: 'text', required: true, placeholder: 'Ej. Certificado de prevención' },
        { name: 'subtitle', label: 'Persona responsable', type: 'text', required: true, placeholder: 'Nombre y apellidos' },
        { name: 'category', label: 'Tipo de documento', type: 'select', options: ['Prevención', 'Seguro', 'Identidad', 'Formación', 'Otro'] },
        { name: 'dueDate', label: 'Fecha de vencimiento', type: 'date' },
      ],
      Incidencias: [
        { name: 'title', label: 'Título de la incidencia', type: 'text', required: true, placeholder: 'Resume el problema' },
        { name: 'priority', label: 'Prioridad', type: 'select', required: true, options: ['Urgente', 'Alta', 'Normal', 'Baja'] },
        { name: 'subtitle', label: 'Descripción', type: 'textarea', required: true, wide: true, placeholder: 'Describe qué ocurrió y qué se necesita' },
        { name: 'location', label: 'Centro o ubicación', type: 'text', placeholder: 'Lugar de la incidencia' },
      ],
      'Vacaciones y permisos': [
        { name: 'title', label: 'Persona solicitante', type: 'text', required: true, placeholder: 'Nombre y apellidos' },
        { name: 'leaveType', label: 'Tipo de solicitud', type: 'select', required: true, options: ['Vacaciones', 'Permiso personal', 'Baja médica', 'Otro'] },
        { name: 'startDate', label: 'Fecha de inicio', type: 'date', required: true },
        { name: 'endDate', label: 'Fecha de fin', type: 'date', required: true },
        { name: 'subtitle', label: 'Motivo o comentario', type: 'textarea', wide: true, placeholder: 'Información adicional' },
      ],
    };
    return fields[this.createModuleName()] ?? fields['Clientes'];
  });

  protected readonly incidents = [
    { title: 'Turno sin cubrir', detail: 'Centro Logístico Sur · Hace 24 min', priority: 'Urgente', tone: 'red', initials: 'CL' },
    { title: 'Uniforme pendiente de entrega', detail: 'Hotel Mirador · Hace 2 h', priority: 'Normal', tone: 'blue', initials: 'HM' },
    { title: 'Ajuste de fichaje', detail: 'Laura Méndez · Hace 4 h', priority: 'En revisión', tone: 'amber', initials: 'LM' },
  ];

  protected readonly absences = [
    { name: 'Paula Serrano', role: 'Vacaciones · 5 días', initials: 'PS', tone: 'peach', dates: '12 — 16 oct' },
    { name: 'Diego Martín', role: 'Permiso personal', initials: 'DM', tone: 'blue', dates: 'Hoy' },
    { name: 'Nora Vidal', role: 'Baja médica', initials: 'NV', tone: 'lilac', dates: 'Desde 03 oct' },
  ];

  protected readonly moduleDescriptions: Record<string, string> = {
    Clientes: 'Consulta y organiza las empresas y personas que trabajan con AURA.',
    'Equipo externo': 'Controla proveedores, colaboradores y equipos asignados.',
    Facturación: 'Revisa el estado de tus facturas y el importe pendiente.',
    Pagos: 'Sigue los pagos recibidos y los próximos vencimientos.',
    Documentos: 'Mantén la documentación vigente y localiza próximas renovaciones.',
    Incidencias: 'Da seguimiento a las incidencias abiertas de tu operación.',
    'Vacaciones y permisos': 'Organiza vacaciones, permisos y otras ausencias del equipo.',
  };

  protected readonly moduleRecords = signal<Record<string, ModuleRecord[]>>({
    Clientes: [
      { id: 'CLI-0248', title: 'Grupo Altamar', subtitle: 'Servicios integrales · Madrid', reference: 'Alta: 14 mar 2024', status: 'Activo', tone: 'green' },
      { id: 'CLI-0247', title: 'Clínica del Prado', subtitle: 'Salud · Madrid', reference: 'Alta: 08 jun 2024', status: 'Activo', tone: 'green' },
      { id: 'CLI-0246', title: 'Espacios Norte', subtitle: 'Oficinas · Bilbao', reference: 'Alta: 19 ene 2025', status: 'Revisar contrato', tone: 'amber' },
    ],
    'Equipo externo': [
      { id: 'EXT-0036', title: 'Nexo Facility', subtitle: 'Mantenimiento · 12 personas', reference: 'Proveedor desde 2023', status: 'Activo', tone: 'green' },
      { id: 'EXT-0035', title: 'Marcos Rivas', subtitle: 'Prevención y seguridad', reference: 'Certificado por renovar', status: 'Pendiente', tone: 'amber' },
      { id: 'EXT-0034', title: 'Logística Vega', subtitle: 'Operaciones · 8 personas', reference: 'Proveedor desde 2024', status: 'Activo', tone: 'green' },
    ],
    Facturación: this.invoices.map((invoice) => ({
      id: invoice.id,
      title: invoice.client,
      subtitle: `${invoice.amount} · ${invoice.date}`,
      reference: invoice.id,
      status: invoice.status,
      tone: invoice.tone === 'red' ? 'coral' : 'amber',
    })),
    Pagos: [
      { id: 'PAG-0108', title: 'Grupo Altamar', subtitle: 'S/ 4,850.00 · Transferencia', reference: '02 oct 2026', status: 'Recibido', tone: 'green' },
      { id: 'PAG-0107', title: 'Clínica del Prado', subtitle: 'S/ 2,340.00 · Domiciliación', reference: '08 oct 2026', status: 'Programado', tone: 'blue' },
      { id: 'PAG-0106', title: 'Espacios Norte', subtitle: 'S/ 6,120.00 · Transferencia', reference: '14 oct 2026', status: 'Pendiente', tone: 'amber' },
    ],
    Documentos: this.documents.map((document, index) => ({
      id: `DOC-00${index + 1}`,
      title: document.name,
      subtitle: document.person,
      reference: document.date,
      status: 'Por vencer',
      tone: 'amber',
    })),
    Incidencias: this.incidents.map((incident, index) => ({
      id: `INC-00${index + 1}`,
      title: incident.title,
      subtitle: incident.detail,
      reference: incident.initials,
      status: incident.priority,
      tone: (incident.tone === 'red' ? 'coral' : incident.tone) as ModuleRecord['tone'],
    })),
    'Vacaciones y permisos': this.absences.map((absence, index) => ({
      id: `AUS-00${index + 1}`,
      title: absence.name,
      subtitle: absence.role,
      reference: absence.dates,
      status: 'Programada',
      tone: 'blue',
    })),
  });

  protected selectNavigation(label: string): void {
    this.activeNav.set(label);
    this.searchTerm.set('');
  }

  protected setAuthMode(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authMessage.set('');
  }

  protected notifyProviderUnavailable(provider: string): void {
    this.authMessage.set(`El acceso con ${provider} requiere configurar OAuth en el servidor.`);
  }

  protected completeAuthentication(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim().toLocaleLowerCase('es');
    const password = String(values.get('password') ?? '');
    const submittedName = String(values.get('name') ?? '').trim();

    if (this.authMode() === 'login' && (email !== demoAdminCredentials.email || password !== demoAdminCredentials.password)) {
      this.authMessage.set('Correo o contraseña incorrectos. Usa la cuenta demo configurada para este proyecto.');
      return;
    }

    if (this.authMode() === 'register' && password !== String(values.get('confirmPassword') ?? '')) {
      this.authMessage.set('Las contraseñas no coinciden.');
      return;
    }

    const emailName = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    const name = submittedName || (email === demoAdminCredentials.email
      ? 'Andre Zapata'
      : emailName.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('es'))) || 'Andre';
    const session = { name, email };
    this.currentUser.set(session);
    try {
      sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(session));
    } catch {
      this.authMessage.set('No se pudo guardar la sesión en este navegador.');
      this.currentUser.set(null);
      return;
    }
    this.authMessage.set('');
    this.activeNav.set('Resumen');
    form.reset();
  }

  protected toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((open) => !open);
  }

  protected signOut(): void {
    if (this.isSigningOut()) return;
    this.isSigningOut.set(true);
    this.isProfileMenuOpen.set(false);
    setTimeout(() => {
      try {
        sessionStorage.removeItem(this.sessionStorageKey);
      } catch {
      }
      this.currentUser.set(null);
      this.authMode.set('login');
      this.authMessage.set('');
      this.isSigningOut.set(false);
    }, 2000);
  }

  private readSessionUser(): UserSession | null {
    try {
      const stored = sessionStorage.getItem(this.sessionStorageKey);
      if (!stored) return null;
      const session = JSON.parse(stored) as Partial<UserSession>;
      return typeof session.name === 'string' && typeof session.email === 'string'
        ? { name: session.name, email: session.email }
        : null;
    } catch {
      return null;
    }
  }

  protected openCreateDialog(): void {
    this.isCreateOpen.set(true);
  }

  protected closeCreateDialog(): void {
    this.isCreateOpen.set(false);
  }

  protected createRecord(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const fields = Object.fromEntries(this.createFields().map((field) => [
      field.name,
      String(values.get(field.name) ?? '').trim(),
    ]));
    const title = fields['title'] ?? '';
    if (!title) return;

    const moduleName = this.createModuleName();
    const formatDate = (date: string) => date
      ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
      : '';
    const formatAmount = (amount: string) => amount
      ? `S/ ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '';
    const today = formatDate(new Date().toISOString().slice(0, 10));
    const amount = formatAmount(fields['amount'] ?? '');
    let subtitle = fields['subtitle'] || 'Registro creado hoy';
    let reference = today;
    let status = 'Nuevo';
    let tone: ModuleRecord['tone'] = 'green';

    switch (moduleName) {
      case 'Clientes':
        subtitle = [fields['subtitle'], fields['service']].filter(Boolean).join(' · ') || 'Cliente nuevo';
        reference = fields['email'] || fields['phone'] || today;
        status = 'Activo';
        break;
      case 'Equipo externo':
        subtitle = [fields['subtitle'], fields['assignment'], fields['email']].filter(Boolean).join(' · ');
        reference = fields['phone'] || today;
        status = 'Activo';
        break;
      case 'Facturación':
        subtitle = [fields['subtitle'], amount].filter(Boolean).join(' · ');
        reference = fields['dueDate'] ? `Vence ${formatDate(fields['dueDate'])}` : today;
        status = 'Pendiente';
        tone = 'amber';
        break;
      case 'Pagos':
        subtitle = [amount, fields['method']].filter(Boolean).join(' · ');
        reference = fields['paymentDate'] ? formatDate(fields['paymentDate']) : today;
        status = 'Registrado';
        tone = 'blue';
        break;
      case 'Documentos':
        subtitle = [fields['subtitle'], fields['category']].filter(Boolean).join(' · ');
        reference = fields['dueDate'] ? `Vence ${formatDate(fields['dueDate'])}` : today;
        status = 'Por vencer';
        tone = 'amber';
        break;
      case 'Incidencias':
        subtitle = [fields['subtitle'], fields['location']].filter(Boolean).join(' · ');
        reference = fields['location'] || today;
        status = fields['priority'] || 'Normal';
        tone = status === 'Urgente' || status === 'Alta' ? 'coral' : 'blue';
        break;
      case 'Vacaciones y permisos':
        subtitle = [fields['leaveType'], fields['subtitle']].filter(Boolean).join(' · ');
        reference = [fields['startDate'], fields['endDate']].filter(Boolean).map(formatDate).join(' — ') || today;
        status = 'Pendiente de aprobación';
        tone = 'amber';
        break;
    }

    const record: ModuleRecord = {
      id: `${moduleName.slice(0, 3).toLocaleUpperCase('es')}-${Date.now().toString().slice(-6)}`,
      title,
      subtitle,
      reference,
      status,
      tone,
    };
    this.moduleRecords.update((records) => ({
      ...records,
      [moduleName]: [record, ...(records[moduleName] ?? [])],
    }));
    form.reset();
    this.isCreateOpen.set(false);
    this.activeNav.set(moduleName);
    this.searchTerm.set('');
  }

  protected toggleRecordStatus(id: string): void {
    const moduleName = this.activeNav() === 'Resumen' ? 'Clientes' : this.activeNav();
    this.moduleRecords.update((records) => ({
      ...records,
      [moduleName]: (records[moduleName] ?? []).map((record) => {
        if (record.id !== id) return record;
        const isReviewed = record.status === 'Revisado';
        return { ...record, status: isReviewed ? 'Pendiente' : 'Revisado', tone: isReviewed ? 'amber' : 'green' };
      }),
    }));
  }

  protected requestDelete(id: string): void {
    const moduleName = this.activeNav() === 'Resumen' ? 'Clientes' : this.activeNav();
    const record = this.moduleRecords()[moduleName]?.find((item) => item.id === id);
    if (record) this.pendingDelete.set(record);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected confirmDelete(): void {
    const record = this.pendingDelete();
    if (!record) return;
    const moduleName = this.activeNav() === 'Resumen' ? 'Clientes' : this.activeNav();
    this.moduleRecords.update((records) => ({
      ...records,
      [moduleName]: (records[moduleName] ?? []).filter((item) => item.id !== record.id),
    }));
    this.pendingDelete.set(null);
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected updatePeriod(event: Event): void {
    this.selectedPeriod.set((event.target as HTMLSelectElement).value);
  }
}
