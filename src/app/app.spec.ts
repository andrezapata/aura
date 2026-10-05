import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
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
    expect(compiled.querySelector('h1')?.textContent).toContain('Buenos días, Andre');
    expect(compiled.textContent).toContain('S/ 86,240');
    expect(compiled.querySelector('.welcome-row .primary-button')).toBeNull();
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
