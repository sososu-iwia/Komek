import type axe from 'axe-core';
const password = 'CypressDemo2026!';
const suffix = Date.now();
const emailA = `e2e-a-${suffix}@astanait.edu.kz`;
const emailB = `e2e-b-${suffix}@astanait.edu.kz`;
const nameA = `E2E Alice ${suffix}`;
const nameB = `E2E Bob ${suffix}`;
let workflowId = '';
let studentId = '';
function requestBudget() {
  cy.request({ url: '/api/health', failOnStatusCode: false, log: false }).then(response => {
    const header = String(response.headers.ratelimit ?? '');
    const remaining = Number(header.match(/r=(\d+)/)?.[1] ?? 300);
    const reset = Number(header.match(/t=(\d+)/)?.[1] ?? response.headers['retry-after'] ?? 1);
    if (response.status === 429 || remaining < 20) cy.wait(Math.min((reset + 1) * 1000, 59000), { log: false }).then(requestBudget);
  });
}
function register(email: string, name: string) {
  cy.intercept('POST', '/api/auth/register').as('registration');
  cy.visit('/register');
  cy.get('input[name="fullName"]').type(name);
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password, { log: false });
  cy.contains('button', 'Create my account').click();
  cy.wait('@registration', { timeout: 60000 }).its('response.statusCode').should('eq', 201);
  cy.contains('Check your inbox').should('be.visible');
  cy.task<string>('verificationLink', email).then(url => cy.visit(url));
  cy.contains('button', 'Verify my email').click();
  cy.contains('You’re all set.').should('be.visible');
}
function login(email: string, secret = password) {
  cy.intercept('POST', '/api/auth/login').as('login');
  cy.visit('/login');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(secret, { log: false });
  cy.contains('button', 'Sign in').click();
  cy.wait('@login', { timeout: 60000 }).its('response.statusCode').should('eq', 200);
  cy.location('pathname').should('eq', '/dashboard');
}
function quickLogin(email: string) {
  cy.request('/api/auth/csrf').then(response => {
    cy.request({ method: 'POST', url: '/api/auth/login', headers: { 'X-CSRF-Token': response.body.token, Origin: 'http://localhost:5173' }, body: { email, password }, log: false });
  });
}
function logout() {
  cy.get('button[aria-label="Open account menu"]').click();
  cy.contains('[role="menuitem"]', 'Sign out').click();
  cy.location('pathname').should('eq', '/');
}
function skills(teach: string, learn: string) {
  cy.visit('/skills');
  cy.get(`button[aria-label="Teach ${teach}"]`).click();
  cy.get(`button[aria-label="Learn ${learn}"]`).click();
  cy.get('button[aria-label="Monday 10:00 UTC"]').click();
  cy.contains('button', 'Save changes').click();
  cy.contains('Your profile and skills have been saved.').should('be.visible');
}
function noOverflow(width: number) {
  cy.document().then(doc => expect(doc.documentElement.scrollWidth, `page fits ${width}px`).to.be.at.most(width));
}
function accessibility() {
  cy.readFile('../../node_modules/axe-core/axe.min.js', { log: false }).then(source => cy.window().then(async win => {
    win.eval(source);
    const result = await (win as unknown as { axe: typeof axe }).axe.run(win.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`), 'WCAG A/AA checks').to.deep.eq([]);
  }));
}
function ready() {
  cy.get('main').should('be.visible');
  cy.get('[aria-label="Loading content"]').should('not.exist');
  cy.get('[role="alert"]').should('not.exist');
  cy.document().its('fonts.status').should('eq', 'loaded');
}
describe('Kömek Skills integrated redesign', () => {
  it('registers, verifies, matches, proposes, accepts, confirms both sessions, and reviews', () => {
    register(emailA, nameA);
    login(emailA);
    cy.visit('/profile');
    cy.get('input[name="faculty"]').type('Software Engineering');
    cy.get('textarea[name="bio"]').type('Fictional automated browser test student.');
    cy.contains('button', 'Save changes').click();
    cy.contains('Your profile and skills have been saved.').should('be.visible');
    skills('Python', 'English');
    logout();
    register(emailB, nameB);
    login(emailB);
    skills('English', 'Python');
    cy.request('/api/auth/me').then(response => { studentId = response.body.id; });
    logout();
    login(emailA);
    cy.visit('/matches');
    cy.get('input[aria-label="Search skills or students…"]').type(nameB);
    cy.contains('article', nameB).within(() => cy.contains('Propose exchange').click());
    cy.contains('button', 'Continue').click();
    cy.get('select[aria-label="Session 1 duration"]').select('30');
    cy.get('[aria-label="Session 1 time 10:30"]').click();
    cy.get('input[aria-label="Session 1 meeting place"]').type('AITU library, room 2');
    cy.contains('button', 'Continue').click();
    cy.get('[aria-label="Session 2 time 11:00"]').click();
    cy.get('input[name="Session 2-location"][value="ONLINE"]').parent().click();
    cy.get('input[aria-label="Session 2 meeting place"]').type('University Teams');
    cy.contains('button', 'Continue').click();
    cy.get('textarea[name="message"]').type('A fictional browser test exchange.');
    cy.intercept('POST', '/api/exchanges').as('proposal');
    cy.contains('button', 'Send exchange proposal').click();
    cy.wait('@proposal', { timeout: 60000 }).its('response.statusCode').should('eq', 201);
    cy.location('pathname').should('not.eq', '/exchanges/new');
    cy.location('pathname').should('match', /^\/exchanges\/.+/);
    cy.location('pathname').then(path => {
      workflowId = path.split('/').pop()!;
      cy.contains('Your proposal is with your partner.').should('be.visible');
      logout();
      login(emailB);
      cy.visit(`/exchanges/${workflowId}`);
      cy.contains('button', 'Accept exchange').click();
      cy.contains('span', 'Accepted').should('be.visible');
      cy.task('endSessions', workflowId);
      cy.reload();
      cy.contains('article', 'Python').within(() => cy.contains('button', 'Confirm session').click());
      cy.contains('article', 'Python').contains('You confirmed').should('be.visible');
      cy.contains('article', 'English').within(() => cy.contains('button', 'Confirm session').click());
      cy.contains('article', 'English').contains('You confirmed').should('be.visible');
      logout();
      login(emailA);
      cy.visit(`/exchanges/${workflowId}`);
      cy.contains('article', 'Python').within(() => cy.contains('button', 'Confirm session').click());
      cy.contains('article', 'Python').contains('Mutually confirmed').should('be.visible');
      cy.contains('article', 'English').within(() => cy.contains('button', 'Confirm session').click());
      cy.contains('Your exchange is complete.').should('be.visible');
      cy.contains('article', 'Python').within(() => {
        cy.get('textarea').type('Clear, friendly explanations. Thank you for the exchange!');
        cy.get('input[aria-label="4 stars"]').parent().click();
        cy.contains('button', 'Share my review').click();
        cy.contains('Your review is shared. Thank you!').should('be.visible');
      });
      cy.visit('/reviews');
      cy.contains('button', 'Given').click();
      cy.contains('Clear, friendly explanations. Thank you for the exchange!').should('be.visible');
      cy.visit('/exchanges?group=completed');
      cy.contains(`Exchange with ${nameB}`).should('be.visible');
      cy.visit('/notifications');
      cy.contains('Exchange complete. Thank you for sharing your skills!').should('be.visible');
    });
  });
  it('authenticates both random local AITU demo accounts and finds their reciprocal skills', () => {
    cy.task<{ email: string; password: string }[]>('demoAccounts', null, { log: false }).then(accounts => {
      accounts.forEach((account, index) => {
        login(account.email, account.password);
        cy.visit('/matches');
        cy.contains('article', index === 0 ? 'Daniyar Omarov' : 'Amina Sadykova').within(() => {
          cy.contains('Python').should('be.visible');
          cy.contains('English').should('be.visible');
          cy.contains('shared hours').should('be.visible');
          cy.get('.avatar').should('have.css', 'background-color').and('not.eq', 'rgba(0, 0, 0, 0)');
          cy.get('.tag-blue').should('have.css', 'background-color').and('not.eq', 'rgba(0, 0, 0, 0)');
        });
        logout();
      });
    });
  });
  it('rejects non-AITU registration on the server and preserves light, dark, and system preferences', () => {
    cy.request('/api/auth/csrf').then(response => {
      cy.request({ method: 'POST', url: '/api/auth/register', headers: { 'X-CSRF-Token': response.body.token, Origin: 'http://localhost:5173' }, body: { email: `e2e-invalid-${suffix}@gmail.com`, password, fullName: 'Invalid Domain' }, failOnStatusCode: false }).its('status').should('eq', 400);
    });
    cy.visit('/login', { onBeforeLoad(win) { win.localStorage.setItem('komek-theme', 'dark'); win.requestAnimationFrame(() => { (win as unknown as { firstFrameTheme: string }).firstFrameTheme = win.document.documentElement.classList.contains('dark') ? 'dark' : 'light'; }); } });
    cy.window().its('firstFrameTheme').should('eq', 'dark');
    cy.get('[aria-label="Choose theme"]').click();
    cy.contains('[role="menuitemradio"]', 'Dark').click();
    cy.get('html').should('have.class', 'dark');
    cy.reload();
    cy.get('html').should('have.class', 'dark');
    cy.window().its('localStorage').invoke('getItem', 'komek-theme').should('eq', 'dark');
    cy.get('[aria-label="Choose theme"]').click();
    cy.contains('[role="menuitemradio"]', 'Light').click();
    cy.get('html').should('not.have.class', 'dark');
    cy.get('[aria-label="Choose theme"]').click();
    cy.contains('[role="menuitemradio"]', 'System').click();
    cy.window().its('localStorage').invoke('getItem', 'komek-theme').should('eq', 'system');
    cy.then(() => Cypress.automation('remote:debugger:protocol', { command: 'Emulation.setEmulatedMedia', params: { features: [{ name: 'prefers-color-scheme', value: 'dark' }] } }));
    cy.get('html').should('have.class', 'dark');
    cy.then(() => Cypress.automation('remote:debugger:protocol', { command: 'Emulation.setEmulatedMedia', params: { features: [{ name: 'prefers-color-scheme', value: 'light' }] } }));
    cy.get('html').should('not.have.class', 'dark');
    cy.then(() => Cypress.automation('remote:debugger:protocol', { command: 'Emulation.setEmulatedMedia', params: { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] } }));
    cy.get('html').should('have.css', 'scroll-behavior', 'auto');
    cy.then(() => Cypress.automation('remote:debugger:protocol', { command: 'Emulation.setEmulatedMedia', params: { features: [] } }));
    quickLogin(emailA);
    cy.visit('/settings');
    cy.get('input[name="theme"][value="dark"]').parent().click();
    cy.get('html').should('have.class', 'dark');
    cy.reload();
    cy.get('input[name="theme"][value="dark"]').should('be.checked');
    cy.get('main').contains('button', 'Sign out').click();
    accessibility();
    cy.get('[role="dialog"]').contains('button', 'Sign out').click();
    cy.location('pathname').should('eq', '/');
  });
  for (const mode of ['light', 'dark']) for (const width of [360, 390, 768, 1024, 1440]) {
    it(`checks real pages at ${width}px in ${mode} mode`, () => {
      cy.viewport(width, 1000);
      for (const route of ['/', '/login', '/register']) {
        requestBudget();
        cy.visit(route, { onBeforeLoad(win) { win.localStorage.setItem('komek-theme', mode); } });
        ready();
        cy.get('html').should(mode === 'dark' ? 'have.class' : 'not.have.class', 'dark');
        noOverflow(width);
        if (width === 360 || width === 1440) { accessibility(); cy.screenshot(`${mode}-${width}-${route === '/' ? 'landing' : route.slice(1)}`, { capture: 'viewport', scale: true }); }
      }
      requestBudget();
      quickLogin(emailA);
      cy.then(() => {
        for (const route of ['/dashboard', '/matches', `/students/${studentId}`, '/profile', '/skills', '/exchanges', `/exchanges/${workflowId}`, '/reviews', '/settings', '/notifications', `/exchanges/new?partner=${studentId}`]) {
          requestBudget();
          cy.visit(route);
          ready();
          noOverflow(width);
          if (width === 360 || width === 1440) { accessibility(); cy.screenshot(`${mode}-${width}-${route.replaceAll(/[/?=]/g, '-')}`, { capture: 'viewport', scale: true }); }
        }
      });
      cy.contains('button', 'Continue').click();
      cy.get('[aria-label="Session 1 meeting place"]').should('be.visible');
      noOverflow(width);
      if (width === 360 || width === 1440) { accessibility(); cy.screenshot(`${mode}-${width}-booking-calendar`, { capture: 'viewport', scale: true }); }
      if (width < 1024) {
        cy.get('[aria-label="Open navigation"]').click();
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[role="dialog"]').contains('a', 'Settings').click();
        cy.location('pathname').should('eq', '/settings');
        cy.get('[role="dialog"]').should('not.exist');
        cy.get('[aria-label="Open navigation"]').click();
        cy.get('body').type('{esc}');
        cy.get('[role="dialog"]').should('not.exist');
        cy.get('[aria-label="Open navigation"]').should('have.focus');
      }
    });
  }
});
