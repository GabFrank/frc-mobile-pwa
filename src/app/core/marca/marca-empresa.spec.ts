import { aplicarMarca, marcaDeEmpresa, marcaInicial } from './marca-empresa';

describe('marca-empresa', () => {
  afterEach(() => localStorage.removeItem('frc.marcaEmpresa'));

  it('elige farmacia si el nombre lo dice, bodega en cualquier otro caso', () => {
    expect(marcaDeEmpresa('FARMACIA FRANCO AREVALOS S.A')).toBe('farmacia');
    expect(marcaDeEmpresa('Farmacia Franco')).toBe('farmacia');
    expect(marcaDeEmpresa('BODEGA FRANCO')).toBe('bodega');
    expect(marcaDeEmpresa(null)).toBe('bodega');
  });

  it('sin marca guardada usa el host; con marca guardada, la guardada', () => {
    expect(marcaInicial('farmacia.app.frcsuite.com')).toBe('farmacia');
    expect(marcaInicial('beta.app.frcsuite.com')).toBe('farmacia');
    expect(marcaInicial('bodega.app.frcsuite.com')).toBe('bodega');
    expect(marcaInicial('localhost')).toBe('bodega');
    localStorage.setItem('frc.marcaEmpresa', 'farmacia');
    expect(marcaInicial('bodega.app.frcsuite.com')).toBe('farmacia');
  });

  it('cambia íconos, manifiesto y título de la app instalada', () => {
    const doc = document.implementation.createHTMLDocument('x');
    doc.head.innerHTML = `
      <link rel="icon" type="image/png" href="assets/images/frc.png" />
      <link rel="icon" type="image/x-icon" href="favicon.ico" />
      <link rel="apple-touch-icon" href="icons/icon-192x192.png" />
      <link rel="manifest" href="manifest.webmanifest" />
      <meta name="apple-mobile-web-app-title" content="Bodega Franco" />`;
    aplicarMarca('farmacia', doc);
    const hrefs = Array.from(doc.querySelectorAll('link')).map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual([
      'assets/images/frc-farmacia.png',
      'icons/farmacia/favicon.ico',
      'icons/farmacia/icon-192x192.png',
      'manifest-farmacia.webmanifest',
    ]);
    expect(doc.querySelector('meta')?.getAttribute('content')).toBe('Farmacia Franco');
    aplicarMarca('bodega', doc);
    expect(doc.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('manifest.webmanifest');
  });
});
