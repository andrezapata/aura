import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';
import { demoAdminCredentials } from './demo-credentials';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.setItem('aura.session', JSON.stringify({ name: 'Andre Zapata', email: 'admin@aura.local' }));
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.removeItem('aura.session');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the AURA dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('AURA');
    expect(compiled.querySelector('.workspace-avatar')?.getAttribute('src')).toBe('/aura-logo.svg');
    expect(compiled.querySelector('.dashboard-date')?.textContent?.trim()).toContain(
      new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date())
        .toLocaleLowerCase('es'),
    );
    expect(compiled.querySelector('.dashboard-footer a')?.getAttribute('href')).toBe('#dashboard');
    expect(compiled.querySelector('h1')?.textContent).toContain('Buenos días, Andre');
    expect(compiled.textContent).toContain('S/ 86,240');
    expect(compiled.querySelector('.welcome-row .primary-button')).toBeNull();
  });

  it('should keep only email-based sign-in and registration options', async () => {
    sessionStorage.removeItem('aura.session');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.provider-actions')).toBeNull();
    expect(compiled.textContent).not.toContain('Google / Gmail');
    expect(compiled.textContent).not.toContain('Facebook');
    expect(compiled.querySelector('.auth-switch')?.textContent).toContain('Registrarme');
  });

  it('should show invoice fields in the invoice creation modal', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const billingButton = [...compiled.querySelectorAll<HTMLButtonElement>('.nav-link')]
      .find((button) => button.textContent?.includes('Facturación'));

    billingButton?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.module-heading .primary-button')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('#create-title')?.textContent).toContain('Nueva factura');
    expect(compiled.querySelector('input[name="amount"]')?.getAttribute('type')).toBe('number');
    expect(compiled.querySelector('input[name="dueDate"]')?.getAttribute('type')).toBe('date');
  });

  it('should require the configured demo administrator credentials', async () => {
    sessionStorage.removeItem('aura.session');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const email = compiled.querySelector<HTMLInputElement>('input[name="email"]')!;
    const password = compiled.querySelector<HTMLInputElement>('input[name="password"]')!;
    const form = compiled.querySelector<HTMLFormElement>('.auth-form')!;

    email.value = demoAdminCredentials.email;
    password.value = demoAdminCredentials.password;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('.profile-copy strong')?.textContent).toBe('Andre Zapata');
    expect(compiled.querySelector('.profile-copy small')?.textContent).toBe('Administrador');
    expect(sessionStorage.getItem('aura.session')).not.toContain(demoAdminCredentials.password);
  });

  it('should keep Firebase accounts as regular users after restoring a session', async () => {
    sessionStorage.setItem('aura.session', JSON.stringify({
      name: 'Lucia Torres',
      email: 'lucia@example.com',
      role: 'Usuario',
    }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.profile-copy small')?.textContent).toBe('Usuario');
  });

  it('should show the required fields for Firebase email registration', async () => {
    sessionStorage.removeItem('aura.session');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.auth-switch button:last-child')?.click();
    fixture.detectChanges();
    expect(compiled.querySelector('input[name="name"]')).not.toBeNull();
    expect(compiled.querySelector('input[name="confirmPassword"]')).not.toBeNull();
  });

  it('should wait before returning to the login screen on sign out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    vi.useFakeTimers();
    compiled.querySelector<HTMLButtonElement>('.account-trigger')?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.logout-action')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.signout-overlay')).not.toBeNull();
    expect(compiled.querySelector('.auth-screen')).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    vi.useRealTimers();

    expect(compiled.querySelector('.signout-overlay')).toBeNull();
    expect(compiled.querySelector('.auth-screen')).not.toBeNull();
  });

  it('should show module-specific fields in every creation modal', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const modules = [
      { name: 'Clientes', title: 'Nuevo cliente', fields: ['service', 'email'] },
      { name: 'Equipo externo', title: 'Nuevo colaborador', fields: ['assignment', 'phone'] },
      { name: 'Facturación', title: 'Nueva factura', fields: ['amount', 'dueDate'] },
      { name: 'Pagos', title: 'Nuevo pago', fields: ['paymentDate', 'method'] },
      { name: 'Documentos', title: 'Nuevo documento', fields: ['category', 'dueDate'] },
      { name: 'Incidencias', title: 'Nueva incidencia', fields: ['priority', 'location'] },
      { name: 'Vacaciones y permisos', title: 'Nueva solicitud', fields: ['leaveType', 'startDate', 'endDate'] },
    ];

    for (const module of modules) {
      const navButton = [...compiled.querySelectorAll<HTMLButtonElement>('.nav-link')]
        .find((button) => button.textContent?.includes(module.name));
      navButton?.click();
      fixture.detectChanges();
      compiled.querySelector<HTMLButtonElement>('.module-heading .primary-button')?.click();
      fixture.detectChanges();

      expect(compiled.querySelector('#create-title')?.textContent?.trim()).toBe(module.title);
      for (const field of module.fields) {
        expect(compiled.querySelector(`[name="${field}"]`)).not.toBeNull();
      }

      compiled.querySelector<HTMLButtonElement>('.create-dialog .icon-button')?.click();
      fixture.detectChanges();
    }
  });

  it('should open the selected module with its records', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const clientsButton = [...compiled.querySelectorAll<HTMLButtonElement>('.nav-link')]
      .find((button) => button.textContent?.includes('Clientes'));

    clientsButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.module-heading h1')?.textContent?.trim()).toBe('Clientes');
    expect(compiled.querySelector('.module-record strong')?.textContent).toContain('Grupo Altamar');
  });

  it('should remove a record only after confirming its deletion', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const clientsButton = [...compiled.querySelectorAll<HTMLButtonElement>('.nav-link')]
      .find((button) => button.textContent?.includes('Clientes'));

    clientsButton?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.delete-record')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.delete-dialog')?.textContent).toContain('Grupo Altamar');
    compiled.querySelector<HTMLButtonElement>('.danger-button')?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.module-panel')?.textContent).not.toContain('Grupo Altamar');
    expect(compiled.querySelector('.table-footnote')?.textContent).toContain('2 registros');
  });
});
