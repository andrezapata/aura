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

  it('should render the AURA Gestión de Operaciones dashboard', async () => {
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
    expect(compiled.textContent).toContain('Tareas activas');
    expect(compiled.textContent).toContain('Seguimiento de Procesos Internos');
    expect(compiled.textContent).toContain('Aprobaciones pendientes');
  });

  it('should advance process steps in the live process monitor ("siguele los pasos al monitor")', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const initialProgress = compiled.querySelector('.proc-progress-badge strong')?.textContent?.trim();
    expect(initialProgress).toBe('60%');

    // Click advance button
    const advanceBtn = compiled.querySelector<HTMLButtonElement>('.advance-btn');
    advanceBtn?.click();
    fixture.detectChanges();

    const newProgress = compiled.querySelector('.proc-progress-badge strong')?.textContent?.trim();
    expect(newProgress).toBe('80%');
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

  it('should show module-specific fields in operational creation modals', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const modules = [
      { name: 'Tareas', title: 'Nueva tarea', fields: ['title', 'assignee', 'department', 'priority'] },
      { name: 'Responsables', title: 'Nuevo responsable', fields: ['title', 'role', 'department', 'email'] },
      { name: 'Solicitudes', title: 'Nueva solicitud', fields: ['title', 'category', 'requester', 'urgency'] },
      { name: 'Aprobaciones', title: 'Nueva aprobación', fields: ['title', 'requester', 'category', 'costOrImpact'] },
      { name: 'Plazos', title: 'Nuevo plazo', fields: ['title', 'relatedEntity', 'targetDate'] },
      { name: 'Seguimiento de procesos', title: 'Nuevo proceso', fields: ['title', 'category', 'responsible'] },
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

  it('should approve items in the approvals list', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const firstApproveBtn = compiled.querySelector<HTMLButtonElement>('.btn-approve');
    expect(firstApproveBtn).not.toBeNull();

    firstApproveBtn?.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Aprobado');
  });

  it('should cycle task status', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const cycleBtn = compiled.querySelector<HTMLButtonElement>('.btn-cycle');
    expect(cycleBtn).not.toBeNull();

    // Initial first task is 'En curso' -> cycles to 'En revisión'
    cycleBtn?.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('En revisión');
  });
});
